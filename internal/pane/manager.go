package pane

import (
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"

	"github.com/creack/pty"
	"github.com/moshtty/moshtty/internal/mux"
	mosh "github.com/unixshells/mosh-go"
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
	info       Info
	shell      string
	cmd        *exec.Cmd
	ptmx       *os.File
	attachment *attachment
	done       chan struct{}
	waitOnce   sync.Once
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

	shell := opts.Shell
	if shell == "" {
		shell = os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/sh"
		}
	}

	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"MOSH_SERVER_NETWORK_TMOUT=86400",
	)
	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{
		Rows: uint16(opts.Rows),
		Cols: uint16(opts.Cols),
	})
	if err != nil {
		return Info{}, fmt.Errorf("start pane pty: %w", err)
	}

	flowID := m.nextID.Add(1)
	info := Info{
		FlowID: flowID,
		Cols:   opts.Cols,
		Rows:   opts.Rows,
	}

	ent := &entry{
		info:  info,
		shell: shell,
		cmd:   cmd,
		ptmx:  ptmx,
		done:  make(chan struct{}),
	}

	initialAttachment, err := m.startAttachment(ent)
	if err != nil {
		_ = ptmx.Close()
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return Info{}, err
	}
	ent.attachment = initialAttachment
	ent.info.Key = initialAttachment.key

	m.mu.Lock()
	m.entries[flowID] = ent
	m.mu.Unlock()

	go func() {
		ent.wait()
		var activeAttachment *attachment
		m.mu.Lock()
		if m.entries[flowID] == ent {
			delete(m.entries, flowID)
		}
		activeAttachment = ent.attachment
		m.mu.Unlock()
		if activeAttachment != nil {
			activeAttachment.close()
		}
	}()

	return ent.info, nil
}

func (m *Manager) Attach(flowID uint32) (Info, error) {
	ent, err := m.get(flowID)
	if err != nil {
		return Info{}, err
	}
	if err := m.replaceAttachment(ent); err != nil {
		return Info{}, err
	}
	m.mu.Lock()
	info := ent.info
	m.mu.Unlock()
	return info, nil
}

func (ent *entry) wait() {
	ent.waitOnce.Do(func() {
		_ = ent.cmd.Wait()
		close(ent.done)
	})
	<-ent.done
}

func (ent *entry) closeProcess() {
	_ = ent.ptmx.Close()
	if ent.cmd.Process != nil {
		_ = ent.cmd.Process.Kill()
	}
	go ent.wait()
	select {
	case <-ent.done:
	case <-time.After(shutdownTimeout):
	}
}

func (m *Manager) Resize(flowID uint32, cols, rows int) error {
	ent, err := m.get(flowID)
	if err != nil {
		return err
	}
	if cols <= 0 || rows <= 0 {
		return fmt.Errorf("invalid resize: %dx%d", cols, rows)
	}
	if err := pty.Setsize(ent.ptmx, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)}); err != nil {
		return fmt.Errorf("resize pty: %w", err)
	}
	m.mu.Lock()
	ent.info.Cols = cols
	ent.info.Rows = rows
	m.mu.Unlock()
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

	if ent.attachment != nil {
		ent.attachment.close()
	}
	ent.closeProcess()
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
	attachment := ent.attachment
	if attachment == nil {
		return ErrPaneClosed
	}
	return attachment.bridge.write(decoded.Payload)
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

func (m *Manager) replaceAttachment(ent *entry) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if ent.attachment != nil {
		ent.attachment.close()
	}
	next, err := m.startAttachment(ent)
	if err != nil {
		return err
	}
	ent.attachment = next
	ent.info.Key = next.key
	return nil
}

func (m *Manager) startAttachment(ent *entry) (*attachment, error) {
	srv, err := mosh.NewServer(ent.shell, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("create mosh server: %w", err)
	}
	bridge, err := newUDPBridge(srv.Port())
	if err != nil {
		srv.Close()
		return nil, err
	}
	rw := newPanePTY(ent.ptmx)
	att := &attachment{
		key:    srv.KeyBase64(),
		server: srv,
		bridge: bridge,
		rw:     rw,
		done:   make(chan struct{}),
	}
	go func() {
		_ = srv.ServeRW(rw, func(cols, rows uint16) {
			_ = pty.Setsize(ent.ptmx, &pty.Winsize{Cols: cols, Rows: rows})
		})
		close(att.done)
	}()
	go bridge.readLoop(func(payload []byte) error {
		return m.routeInbound(ent.info.FlowID, payload)
	})
	return att, nil
}

type attachment struct {
	key    string
	server *mosh.Server
	bridge *udpBridge
	rw     *panePTY
	done   chan struct{}
	once   sync.Once
}

func (a *attachment) close() {
	a.once.Do(func() {
		a.bridge.close()
		a.rw.Close()
		select {
		case <-a.done:
		case <-time.After(shutdownTimeout):
		}
	})
}

type panePTY struct {
	file   *os.File
	closed chan struct{}
	once   sync.Once
}

func newPanePTY(file *os.File) *panePTY {
	return &panePTY{
		file:   file,
		closed: make(chan struct{}),
	}
}

func (p *panePTY) Read(buf []byte) (int, error) {
	for {
		select {
		case <-p.closed:
			return 0, os.ErrClosed
		default:
		}
		_ = p.file.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
		n, err := p.file.Read(buf)
		if n > 0 {
			return n, nil
		}
		if err != nil {
			if os.IsTimeout(err) {
				continue
			}
			return 0, err
		}
	}
}

func (p *panePTY) Write(buf []byte) (int, error) {
	select {
	case <-p.closed:
		return 0, os.ErrClosed
	default:
	}
	return p.file.Write(buf)
}

func (p *panePTY) Close() error {
	p.once.Do(func() {
		close(p.closed)
	})
	return nil
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

func (m *Manager) List() []Info {
	m.mu.Lock()
	defer m.mu.Unlock()
	list := make([]Info, 0, len(m.entries))
	for _, ent := range m.entries {
		list = append(list, ent.info)
	}
	return list
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
