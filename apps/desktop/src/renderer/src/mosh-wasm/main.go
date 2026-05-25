//go:build js && wasm

package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"sync"
	"syscall/js"
	"time"

	mosh "github.com/unixshells/mosh-go"
)

type jsConn struct {
	writeFn  js.Value
	readChan chan []byte
	closed   chan struct{}
}

func (c *jsConn) Read(b []byte) (int, error) {
	select {
	case <-c.closed:
		return 0, io.EOF
	case data, ok := <-c.readChan:
		if !ok {
			return 0, io.EOF
		}
		n := copy(b, data)
		return n, nil
	}
}

func (c *jsConn) Write(b []byte) (int, error) {
	select {
	case <-c.closed:
		return 0, io.EOF
	default:
	}
	uint8Array := js.Global().Get("Uint8Array").New(len(b))
	js.CopyBytesToJS(uint8Array, b)
	c.writeFn.Invoke(uint8Array)
	return len(b), nil
}

func (c *jsConn) SetReadDeadline(t time.Time) error {
	return nil
}

func (c *jsConn) Close() error {
	select {
	case <-c.closed:
	default:
		close(c.closed)
	}
	return nil
}

type moshClientInstance struct {
	client *mosh.Client
	conn   *jsConn
	done   chan struct{}
}

var (
	connections   = make(map[string]*moshClientInstance)
	connectionsMu sync.Mutex
)

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func jsMoshDial(this js.Value, args []js.Value) any {
	if len(args) < 3 {
		return "error: missing arguments"
	}
	keyB64 := args[0].String()
	writePacketFn := args[1]
	onOutput := args[2]

	key, err := decodeBase64Key(keyB64)
	if err != nil {
		return fmt.Sprintf("error: invalid key: %v", err)
	}
	ocb, err := mosh.NewOCB(key)
	if err != nil {
		return fmt.Sprintf("error: new ocb: %v", err)
	}

	conn := &jsConn{
		writeFn:  writePacketFn,
		readChan: make(chan []byte, 1000),
		closed:   make(chan struct{}),
	}

	client, err := mosh.DialConnManual(conn, ocb)
	if err != nil {
		return fmt.Sprintf("error: dial conn: %v", err)
	}

	connID := generateID()
	inst := &moshClientInstance{
		client: client,
		conn:   conn,
		done:   make(chan struct{}),
	}

	connectionsMu.Lock()
	connections[connID] = inst
	connectionsMu.Unlock()

	// Tick loop
	go func() {
		ticker := time.NewTicker(20 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-conn.closed:
				close(inst.done)
				return
			case <-ticker.C:
				client.Tick()
			}
		}
	}()

	// Recv loop
	go func() {
		for {
			select {
			case <-conn.closed:
				return
			default:
			}
			data := client.Recv(5 * time.Millisecond)
			if len(data) > 0 {
				uint8Array := js.Global().Get("Uint8Array").New(len(data))
				js.CopyBytesToJS(uint8Array, data)
				onOutput.Invoke(uint8Array)
			}
		}
	}()

	return connID
}

func jsMoshReceive(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return "error: missing arguments"
	}
	connID := args[0].String()
	jsData := args[1]

	connectionsMu.Lock()
	inst, ok := connections[connID]
	connectionsMu.Unlock()
	if !ok {
		return "error: unknown connection ID"
	}

	length := jsData.Get("length").Int()
	b := make([]byte, length)
	js.CopyBytesToGo(b, jsData)

	select {
	case <-inst.conn.closed:
		return "error: connection closed"
	case inst.conn.readChan <- b:
	default:
	}

	return nil
}

func jsMoshSend(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return "error: missing arguments"
	}
	connID := args[0].String()
	jsData := args[1]

	connectionsMu.Lock()
	inst, ok := connections[connID]
	connectionsMu.Unlock()
	if !ok {
		return "error: unknown connection ID"
	}

	length := jsData.Get("length").Int()
	b := make([]byte, length)
	js.CopyBytesToGo(b, jsData)

	inst.client.Send(b)
	inst.client.Tick()

	return nil
}

func jsMoshResize(this js.Value, args []js.Value) any {
	if len(args) < 3 {
		return "error: missing arguments"
	}
	connID := args[0].String()
	cols := args[1].Int()
	rows := args[2].Int()

	connectionsMu.Lock()
	inst, ok := connections[connID]
	connectionsMu.Unlock()
	if !ok {
		return "error: unknown connection ID"
	}

	inst.client.Resize(uint16(cols), uint16(rows))
	inst.client.Tick()

	return nil
}

func jsMoshClose(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return "error: missing arguments"
	}
	connID := args[0].String()

	connectionsMu.Lock()
	inst, ok := connections[connID]
	if ok {
		delete(connections, connID)
	}
	connectionsMu.Unlock()

	if ok {
		_ = inst.conn.Close()
		inst.client.Close()
		<-inst.done
	}

	return nil
}

func decodeBase64Key(s string) ([]byte, error) {
	if dec, err := base64.StdEncoding.DecodeString(s); err == nil {
		return dec, nil
	}
	if dec, err := base64.RawStdEncoding.DecodeString(s); err == nil {
		return dec, nil
	}
	if dec, err := base64.URLEncoding.DecodeString(s); err == nil {
		return dec, nil
	}
	return base64.RawURLEncoding.DecodeString(s)
}

func main() {
	js.Global().Set("moshttyMoshDial", js.FuncOf(jsMoshDial))
	js.Global().Set("moshttyMoshReceive", js.FuncOf(jsMoshReceive))
	js.Global().Set("moshttyMoshSend", js.FuncOf(jsMoshSend))
	js.Global().Set("moshttyMoshResize", js.FuncOf(jsMoshResize))
	js.Global().Set("moshttyMoshClose", js.FuncOf(jsMoshClose))

	select {}
}
