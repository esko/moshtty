package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/creack/pty"
)

const (
	workerFrameAttach byte = 1
	workerFrameInput  byte = 2
	workerFrameResize byte = 3
	workerFrameOutput byte = 4
	workerFrameStatus byte = 5
	workerFrameError  byte = 6
	workerFrameExit   byte = 7
	workerFrameKill   byte = 8

	workerMaxFrameSize = 2 * 1024 * 1024
	workerReplayLimit  = 4 * 1024 * 1024
	workerReplayTrimAt = workerReplayLimit + 512*1024
)

type workerAttachMessage struct {
	SessionID string `json:"sessionId"`
	Cols      int    `json:"cols"`
	Rows      int    `json:"rows"`
	Restore   bool   `json:"restore"`
}

type workerResizeMessage struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

type workerSession struct {
	root        string
	id          string
	sessionDir  string
	socketPath  string
	capturePath string

	mu          sync.Mutex
	ptmx        *os.File
	cmd         *exec.Cmd
	shell       string
	clients     map[*workerClient]struct{}
	replay      []byte
	captureFile *os.File
	exited      bool
	exitCode    int
}

type workerClient struct {
	conn net.Conn
	mu   sync.Mutex
}

func runSessionWorker(root, id string) error {
	if !validSessionID(id) {
		return fmt.Errorf("invalid session id %q", id)
	}
	worker := &workerSession{
		root:        root,
		id:          id,
		sessionDir:  filepath.Join(root, id),
		socketPath:  filepath.Join(root, id, "worker.sock"),
		capturePath: filepath.Join(root, id, "capture.log"),
		clients:     make(map[*workerClient]struct{}),
	}
	if err := worker.init(); err != nil {
		return err
	}
	return worker.serve()
}

func (w *workerSession) init() error {
	if err := os.MkdirAll(w.sessionDir, 0o700); err != nil {
		return err
	}
	if data, err := os.ReadFile(w.capturePath); err == nil {
		if len(data) > workerReplayLimit {
			data = data[len(data)-workerReplayLimit:]
		}
		w.replay = append(w.replay, data...)
	}
	captureFile, err := os.OpenFile(w.capturePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	w.captureFile = captureFile
	return nil
}

func (w *workerSession) serve() error {
	_ = os.Remove(w.socketPath)
	listener, err := net.Listen("unix", w.socketPath)
	if err != nil {
		return err
	}
	defer listener.Close()
	defer os.Remove(w.socketPath)
	defer w.close()
	_ = os.Chmod(w.socketPath, 0o600)
	w.updateMetadata(sessionStatusRunning)

	for {
		conn, err := listener.Accept()
		if err != nil {
			return err
		}
		go w.handleConn(conn)
	}
}

func (w *workerSession) handleConn(conn net.Conn) {
	client := &workerClient{conn: conn}
	defer conn.Close()

	for {
		frameType, payload, err := readWorkerFrame(conn)
		if err != nil {
			w.removeClient(client)
			return
		}
		switch frameType {
		case workerFrameAttach:
			var msg workerAttachMessage
			if err := json.Unmarshal(payload, &msg); err != nil {
				writeWorkerError(client, "invalid attach message", err)
				continue
			}
			cols, rows, err := sanitizeSize(msg.Cols, msg.Rows)
			if err != nil {
				writeWorkerError(client, "invalid terminal size", err)
				continue
			}
			if err := w.attach(client, cols, rows, msg.Restore); err != nil {
				writeWorkerError(client, "failed to attach", err)
			}
		case workerFrameInput:
			w.writePTY(payload)
		case workerFrameResize:
			var msg workerResizeMessage
			if err := json.Unmarshal(payload, &msg); err != nil {
				writeWorkerError(client, "invalid resize message", err)
				continue
			}
			cols, rows, err := sanitizeSize(msg.Cols, msg.Rows)
			if err != nil {
				writeWorkerError(client, "invalid terminal size", err)
				continue
			}
			w.resize(cols, rows)
		case workerFrameKill:
			w.kill()
			w.updateMetadata(sessionStatusExited)
			time.AfterFunc(150*time.Millisecond, func() {
				os.Exit(0)
			})
			return
		}
	}
}

func (w *workerSession) attach(client *workerClient, cols, rows int, restore bool) error {
	if err := w.startPTY(cols, rows); err != nil {
		return err
	}

	w.mu.Lock()
	w.clients[client] = struct{}{}
	replay := append([]byte(nil), w.replay...)
	shell := w.shell
	exited := w.exited
	exitCode := w.exitCode
	w.mu.Unlock()

	statusPayload, _ := json.Marshal(serverMessage{Type: "status", Shell: shell})
	if err := client.writeFrame(workerFrameStatus, statusPayload); err != nil {
		return err
	}
	if restore && len(replay) > 0 {
		if err := client.writeFrame(workerFrameOutput, replay); err != nil {
			return err
		}
	}
	if exited {
		exitPayload, _ := json.Marshal(serverMessage{Type: "exit", Code: exitCode})
		_ = client.writeFrame(workerFrameExit, exitPayload)
	}
	return nil
}

func (w *workerSession) startPTY(cols, rows int) error {
	w.mu.Lock()
	if w.ptmx != nil || w.exited {
		w.mu.Unlock()
		return nil
	}
	shell, args := chooseShell()
	cmd := exec.Command(shell, args...)
	cmd.Dir = userHome()
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"COLORTERM=truecolor",
		"TERM_PROGRAM=ghostty-web",
		"TERM_PROGRAM_VERSION=0.1.0",
	)
	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
	if err != nil {
		w.mu.Unlock()
		return err
	}
	w.ptmx = ptmx
	w.cmd = cmd
	w.shell = shell
	w.mu.Unlock()

	w.updateMetadata(sessionStatusRunning)
	go w.readPTY()
	go w.waitPTY()
	return nil
}

func (w *workerSession) readPTY() {
	buf := make([]byte, 32*1024)
	for {
		w.mu.Lock()
		ptmx := w.ptmx
		w.mu.Unlock()
		if ptmx == nil {
			return
		}
		n, err := ptmx.Read(buf)
		if n > 0 {
			chunk := append([]byte(nil), buf[:n]...)
			w.capture(chunk)
			w.answerTerminalQueries(chunk)
			w.broadcast(workerFrameOutput, chunk)
		}
		if err != nil {
			return
		}
	}
}

func (w *workerSession) waitPTY() {
	w.mu.Lock()
	cmd := w.cmd
	w.mu.Unlock()
	if cmd == nil {
		return
	}
	err := cmd.Wait()
	exitCode := 0
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		exitCode = exitErr.ExitCode()
	}

	w.mu.Lock()
	w.exited = true
	w.exitCode = exitCode
	if w.ptmx != nil {
		_ = w.ptmx.Close()
		w.ptmx = nil
	}
	w.mu.Unlock()

	w.updateMetadata(sessionStatusExited)
	payload, _ := json.Marshal(serverMessage{Type: "exit", Code: exitCode})
	w.broadcast(workerFrameExit, payload)
}

func (w *workerSession) writePTY(data []byte) {
	if len(data) == 0 {
		return
	}
	w.mu.Lock()
	ptmx := w.ptmx
	w.mu.Unlock()
	if ptmx == nil {
		return
	}
	_, _ = ptmx.Write(data)
}

func (w *workerSession) resize(cols, rows int) {
	w.mu.Lock()
	ptmx := w.ptmx
	w.mu.Unlock()
	if ptmx == nil {
		return
	}
	_ = pty.Setsize(ptmx, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
}

func (w *workerSession) capture(data []byte) {
	w.mu.Lock()
	if w.captureFile != nil {
		_, _ = w.captureFile.Write(data)
	}
	w.replay = append(w.replay, data...)
	if len(w.replay) > workerReplayTrimAt {
		w.replay = append([]byte(nil), w.replay[len(w.replay)-workerReplayLimit:]...)
	}
	w.mu.Unlock()
}

func (w *workerSession) answerTerminalQueries(data []byte) {
	w.mu.Lock()
	clientCount := len(w.clients)
	w.mu.Unlock()
	if clientCount > 0 {
		return
	}
	if bytes.Contains(data, []byte{0x1b, '[', 'c'}) || bytes.Contains(data, []byte{0x1b, '[', '0', 'c'}) {
		w.writePTY([]byte("\x1b[?1;2c"))
	}
	if bytes.Contains(data, []byte{0x1b, '[', '>', 'c'}) || bytes.Contains(data, []byte{0x1b, '[', '>', '0', 'c'}) {
		w.writePTY([]byte("\x1b[>0;10;1c"))
	}
}

func (w *workerSession) broadcast(frameType byte, payload []byte) {
	w.mu.Lock()
	clients := make([]*workerClient, 0, len(w.clients))
	for client := range w.clients {
		clients = append(clients, client)
	}
	w.mu.Unlock()
	for _, client := range clients {
		if err := client.writeFrame(frameType, payload); err != nil {
			w.removeClient(client)
			_ = client.conn.Close()
		}
	}
}

func (w *workerSession) removeClient(client *workerClient) {
	w.mu.Lock()
	delete(w.clients, client)
	w.mu.Unlock()
}

func (w *workerSession) kill() {
	w.mu.Lock()
	cmd := w.cmd
	ptmx := w.ptmx
	w.mu.Unlock()
	if ptmx != nil {
		_ = ptmx.Close()
	}
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Signal(os.Interrupt)
		time.AfterFunc(750*time.Millisecond, func() {
			_ = cmd.Process.Kill()
		})
	}
}

func (w *workerSession) close() {
	w.kill()
	w.mu.Lock()
	if w.captureFile != nil {
		_ = w.captureFile.Close()
		w.captureFile = nil
	}
	w.mu.Unlock()
	w.updateMetadata(sessionStatusExited)
}

func (w *workerSession) updateMetadata(status string) {
	session := &terminalSession{
		ID:        w.id,
		Title:     "Terminal",
		Shell:     w.shell,
		Status:    status,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		PID:       os.Getpid(),
		Socket:    w.socketPath,
	}
	if existing, err := (&sessionManager{root: w.root}).readMetadata(w.id); err == nil {
		session.CreatedAt = existing.CreatedAt
		session.ParentID = existing.ParentID
		session.CustomTitle = existing.CustomTitle
		if existing.CustomTitle && existing.Title != "" {
			session.Title = existing.Title
		}
	}
	if !session.CustomTitle {
		session.Title = automaticSessionTitle(w.shell)
	}
	if err := (&sessionManager{root: w.root}).writeMetadata(session); err != nil {
		log.Printf("write session metadata: %v", err)
	}
}

func (c *workerClient) Write(data []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.Write(data)
}

func (c *workerClient) writeFrame(frameType byte, payload []byte) error {
	return writeWorkerFrame(c, frameType, payload)
}

func writeWorkerFrame(w io.Writer, frameType byte, payload []byte) error {
	if len(payload) > workerMaxFrameSize {
		return fmt.Errorf("worker frame too large: %d", len(payload))
	}
	header := [5]byte{frameType}
	binary.BigEndian.PutUint32(header[1:], uint32(len(payload)))
	if _, err := w.Write(header[:]); err != nil {
		return err
	}
	if len(payload) == 0 {
		return nil
	}
	_, err := w.Write(payload)
	return err
}

func readWorkerFrame(r io.Reader) (byte, []byte, error) {
	var header [5]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return 0, nil, err
	}
	size := binary.BigEndian.Uint32(header[1:])
	if size > workerMaxFrameSize {
		return 0, nil, fmt.Errorf("worker frame too large: %d", size)
	}
	payload := make([]byte, int(size))
	if size > 0 {
		if _, err := io.ReadFull(r, payload); err != nil {
			return 0, nil, err
		}
	}
	return header[0], payload, nil
}
