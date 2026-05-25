package pane

import (
	"errors"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	mosh "github.com/unixshells/mosh-go"
	"github.com/moshtty/moshtty/internal/mux"
)

var (
	ErrUnknownFlow = errors.New("unknown pane flow")
	ErrPaneClosed  = errors.New("pane is closed")
)

type CreateOptions struct {
	Shell string
	Cols  int
	Rows  int
}

type Info struct {
	FlowID uint32 `json:"flowId"`
	Key    string `json:"key"`
	Cols   int    `json:"cols"`
	Rows   int    `json:"rows"`
}

type entry struct {
	info   Info
	server *mosh.Server
	bridge *udpBridge
	closed chan struct{}
}

type Manager struct {
	mu           sync.Mutex
	nextID       atomic.Uint32
	entries      map[uint32]*entry
	sendDatagram func([]byte) error
}

func NewManager() *Manager {
	m := &Manager{
		entries: make(map[uint32]*entry),
	}
	m.nextID.Store(1)
	return m
}

func (m *Manager) SetDatagramSender(send func([]byte) error) {
	m.mu.Lock()
	m.sendDatagram = send
	m.mu.Unlock()
}

func (m *Manager) Create(opts CreateOptions) (Info, error) {
	if opts.Cols <= 0 {
		opts.Cols = 80
	}
	if opts.Rows <= 0 {
		opts.Rows = 24
	}

	srv, err := mosh.NewServer(opts.Shell, 0, 0)
	if err != nil {
		return Info{}, fmt.Errorf("create mosh server: %w", err)
	}

	flowID := m.nextID.Add(1)
	bridge, err := newUDPBridge(srv.Port())
	if err != nil {
		srv.Close()
		return Info{}, err
	}

	info := Info{
		FlowID: flowID,
		Key:    srv.KeyBase64(),
		Cols:   opts.Cols,
		Rows:   opts.Rows,
	}

	ent := &entry{
		info:   info,
		server: srv,
		bridge: bridge,
		closed: make(chan struct{}),
	}

	m.mu.Lock()
	m.entries[flowID] = ent
	m.mu.Unlock()

	go func() {
		_ = srv.Serve()
		close(ent.closed)
	}()
	go ent.bridge.readLoop(func(payload []byte) error {
		return m.routeInbound(flowID, payload)
	})

	return info, nil
}

func (m *Manager) Attach(flowID uint32) (Info, error) {
	ent, err := m.get(flowID)
	if err != nil {
		return Info{}, err
	}
	return ent.info, nil
}

func (m *Manager) Resize(flowID uint32, cols, rows int) error {
	if _, err := m.get(flowID); err != nil {
		return err
	}
	if cols <= 0 || rows <= 0 {
		return fmt.Errorf("invalid resize: %dx%d", cols, rows)
	}
	return nil
}

const shutdownTimeout = 2 * time.Second

func (m *Manager) Close(flowID uint32) error {
	ent, err := m.get(flowID)
	if err != nil {
		return err
	}

	m.mu.Lock()
	delete(m.entries, flowID)
	m.mu.Unlock()

	ent.bridge.close()
	ent.server.Close()
	select {
	case <-ent.closed:
	case <-time.After(shutdownTimeout):
	}
	return nil
}

func (m *Manager) RouteOutbound(frame []byte) error {
	decoded, err := mux.Decode(frame)
	if err != nil {
		return err
	}
	ent, err := m.get(decoded.FlowID)
	if err != nil {
		return err
	}
	return ent.bridge.write(decoded.Payload)
}

func (m *Manager) routeInbound(flowID uint32, payload []byte) error {
	m.mu.Lock()
	send := m.sendDatagram
	m.mu.Unlock()
	if send == nil {
		return errors.New("datagram sender is not configured")
	}
	frame, err := mux.Encode(mux.Frame{
		FlowID:  flowID,
		Payload: payload,
	})
	if err != nil {
		return err
	}
	return send(frame)
}

func (m *Manager) get(flowID uint32) (*entry, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	ent, ok := m.entries[flowID]
	if !ok {
		return nil, fmt.Errorf("%w: %d", ErrUnknownFlow, flowID)
	}
	return ent, nil
}

type udpBridge struct {
	conn   *net.UDPConn
	server *net.UDPAddr
	closed chan struct{}
	once   sync.Once
}

func newUDPBridge(serverPort int) (*udpBridge, error) {
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 0})
	if err != nil {
		return nil, fmt.Errorf("listen bridge udp: %w", err)
	}
	return &udpBridge{
		conn:   conn,
		server: &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: serverPort},
		closed: make(chan struct{}),
	}, nil
}

func (b *udpBridge) write(payload []byte) error {
	select {
	case <-b.closed:
		return ErrPaneClosed
	default:
	}
	_, err := b.conn.WriteToUDP(payload, b.server)
	return err
}

func (b *udpBridge) readLoop(send func([]byte) error) {
	buf := make([]byte, 64*1024)
	for {
		select {
		case <-b.closed:
			return
		default:
		}
		n, _, err := b.conn.ReadFromUDP(buf)
		if err != nil {
			select {
			case <-b.closed:
				return
			default:
				continue
			}
		}
		payload := append([]byte(nil), buf[:n]...)
		if err := send(payload); err != nil {
			return
		}
	}
}

func (b *udpBridge) close() {
	b.once.Do(func() {
		close(b.closed)
		_ = b.conn.Close()
	})
}
