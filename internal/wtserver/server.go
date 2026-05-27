package wtserver

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"

	"github.com/moshtty/moshtty/internal/auth"
	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/jsonrpc"
	"github.com/moshtty/moshtty/internal/pane"
	"github.com/moshtty/moshtty/internal/profile"
)

const controlPath = "/webtransport"

type Options struct {
	Config config.Config
	Token  string
	Cert   tls.Certificate
}

type Server struct {
	cfgMu  sync.RWMutex
	cfg    config.Config
	token  string
	panes  *pane.Manager
	wt     webtransport.Server
	udpLn  *net.UDPConn
	mu     sync.Mutex
	closed bool

	sessionMu sync.Mutex
	session   *sessionState
	nextAppID atomic.Uint64

	certMu sync.RWMutex
	cert   *tls.Certificate
}

func New(opts Options) (*Server, error) {
	if opts.Token == "" {
		return nil, errors.New("token is required")
	}

	s := &Server{
		cfg:   opts.Config,
		token: opts.Token,
		panes: pane.NewManager(),
		cert:  &opts.Cert,
	}

	tlsConf := &tls.Config{
		GetCertificate: func(info *tls.ClientHelloInfo) (*tls.Certificate, error) {
			return s.getActiveCertificate(), nil
		},
		NextProtos: []string{http3.NextProtoH3},
	}

	s.wt = webtransport.Server{
		H3: &http3.Server{
			TLSConfig: tlsConf,
		},
		CheckOrigin: func(r *http.Request) bool {
			s.cfgMu.RLock()
			allowed := s.cfg.AllowedOrigins
			s.cfgMu.RUnlock()
			return auth.OriginAllowed(r.Header.Get("Origin"), allowed)
		},
	}

	s.panes.SetDatagramSender(func(data []byte) error {
		return s.sendDatagram(data)
	})

	mux := http.NewServeMux()
	mux.HandleFunc(controlPath, s.handleWebTransport)
	s.wt.H3.Handler = mux
	webtransport.ConfigureHTTP3Server(s.wt.H3)

	return s, nil
}

func (s *Server) ListenAndServe(ctx context.Context, bind string) error {
	udpAddr, err := net.ResolveUDPAddr("udp", bind)
	if err != nil {
		return fmt.Errorf("resolve udp addr: %w", err)
	}
	udpLn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		return fmt.Errorf("listen udp: %w", err)
	}
	s.udpLn = udpLn

	errCh := make(chan error, 1)
	go func() {
		errCh <- s.wt.Serve(udpLn)
	}()

	select {
	case <-ctx.Done():
		_ = s.Close()
		return ctx.Err()
	case err := <-errCh:
		return err
	}
}

func (s *Server) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	err := s.wt.Close()
	if s.udpLn != nil {
		_ = s.udpLn.Close()
	}
	return err
}

func (s *Server) handleWebTransport(w http.ResponseWriter, r *http.Request) {
	token := auth.TokenFromRequest(r)
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if err := auth.ValidateToken(token, s.token); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	s.cfgMu.RLock()
	allowedOrigins := s.cfg.AllowedOrigins
	s.cfgMu.RUnlock()
	if err := auth.ValidateOrigin(r.Header.Get("Origin"), allowedOrigins); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	session, err := s.wt.Upgrade(w, r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	go s.serveSession(session)
}

type sessionState struct {
	session *webtransport.Session
	encoder *json.Encoder
	writeMu sync.Mutex
	pending map[string]chan appResponse
	mu      sync.Mutex
}

type controlMessage struct {
	JSONRPC string               `json:"jsonrpc"`
	ID      json.RawMessage      `json:"id,omitempty"`
	Method  string               `json:"method,omitempty"`
	Params  json.RawMessage      `json:"params,omitempty"`
	Result  json.RawMessage      `json:"result,omitempty"`
	Error   *jsonrpc.ErrorObject `json:"error,omitempty"`
}

type appResponse struct {
	result json.RawMessage
	err    error
}

func (s *Server) serveSession(session *webtransport.Session) {
	state := &sessionState{
		session: session,
		pending: make(map[string]chan appResponse),
	}
	s.sessionMu.Lock()
	s.session = state
	s.sessionMu.Unlock()
	defer func() {
		s.sessionMu.Lock()
		if s.session == state {
			s.session = nil
		}
		s.sessionMu.Unlock()
		state.closePending(errors.New("app control session closed"))
		_ = session.CloseWithError(0, "")
	}()

	ctx := context.Background()
	controlStream, err := session.AcceptStream(ctx)
	if err != nil {
		return
	}

	go s.readDatagrams(state)
	s.serveControl(state, controlStream)
}

func (s *Server) serveControl(state *sessionState, stream io.ReadWriteCloser) {
	defer func() { _ = stream.Close() }()
	decoder := json.NewDecoder(stream)
	state.encoder = json.NewEncoder(stream)

	for {
		var msg controlMessage
		if err := decoder.Decode(&msg); err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			_ = state.writeJSON(jsonrpc.NewErrorResponse(nil, jsonrpc.CodeParseError, err.Error(), nil))
			return
		}

		if msg.Method == "" {
			state.resolveResponse(msg)
			continue
		}

		req := jsonrpc.Request{
			JSONRPC: msg.JSONRPC,
			ID:      msg.ID,
			Method:  msg.Method,
			Params:  msg.Params,
		}
		result, err := s.Dispatch(req)
		if err != nil {
			resp := jsonrpc.NewErrorResponse(req.ID, jsonrpc.ErrorCode(err), err.Error(), nil)
			_ = state.writeJSON(resp)
			continue
		}
		resp := jsonrpc.NewResultResponse(req.ID, result)
		_ = state.writeJSON(resp)
	}
}

// Dispatch exposes the JSON-RPC dispatch logic.
func (s *Server) Dispatch(req jsonrpc.Request) (any, error) {
	return s.dispatch(req)
}

func (s *Server) dispatch(req jsonrpc.Request) (any, error) {
	switch req.Method {
	case "health":
		s.cfgMu.RLock()
		remoteID := s.cfg.RemoteID
		bindEndpoint := s.cfg.BindEndpoint()
		currentCertHash := s.cfg.Cert.CurrentHash
		nextCertHash := s.cfg.Cert.NextHash
		s.cfgMu.RUnlock()
		return map[string]any{
			"status":          "ok",
			"remoteId":        remoteID,
			"serviceVersion":  profile.Version,
			"bindEndpoint":    bindEndpoint,
			"currentCertHash": currentCertHash,
			"nextCertHash":    nextCertHash,
		}, nil
	case "pane.list":
		return map[string]any{"panes": s.panes.List()}, nil
	case "app.pane.split":
		return s.requestApp(context.Background(), req.Method, req.Params)
	case "pane.create":
		var params struct {
			Shell string `json:"shell"`
			Cols  int    `json:"cols"`
			Rows  int    `json:"rows"`
		}
		if len(req.Params) > 0 {
			if err := json.Unmarshal(req.Params, &params); err != nil {
				return nil, fmt.Errorf("%w: %v", jsonrpc.ErrInvalidParams, err)
			}
		}
		return s.panes.Create(pane.CreateOptions{
			Shell: params.Shell,
			Cols:  params.Cols,
			Rows:  params.Rows,
		})
	case "pane.attach":
		var params struct {
			FlowID uint32 `json:"flowId"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return nil, fmt.Errorf("%w: %v", jsonrpc.ErrInvalidParams, err)
		}
		return s.panes.Attach(params.FlowID)
	case "pane.resize":
		var params struct {
			FlowID uint32 `json:"flowId"`
			Cols   int    `json:"cols"`
			Rows   int    `json:"rows"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return nil, fmt.Errorf("%w: %v", jsonrpc.ErrInvalidParams, err)
		}
		if err := s.panes.Resize(params.FlowID, params.Cols, params.Rows); err != nil {
			return nil, err
		}
		return map[string]any{"ok": true}, nil
	case "pane.close":
		var params struct {
			FlowID uint32 `json:"flowId"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return nil, fmt.Errorf("%w: %v", jsonrpc.ErrInvalidParams, err)
		}
		if err := s.panes.Close(params.FlowID); err != nil {
			return nil, err
		}
		return map[string]any{"ok": true}, nil
	default:
		return nil, jsonrpc.ErrMethodNotFound
	}
}

func (s *Server) readDatagrams(state *sessionState) {
	for {
		data, err := state.session.ReceiveDatagram(context.Background())
		if err != nil {
			return
		}
		if err := s.panes.RouteOutbound(data); err != nil {
			continue
		}
	}
}

func (s *Server) sendDatagram(data []byte) error {
	s.sessionMu.Lock()
	state := s.session
	s.sessionMu.Unlock()
	if state == nil {
		return errors.New("no active webtransport session")
	}
	return state.session.SendDatagram(data)
}

func (s *Server) requestApp(ctx context.Context, method string, params json.RawMessage) (any, error) {
	s.sessionMu.Lock()
	state := s.session
	s.sessionMu.Unlock()
	if state == nil {
		return nil, errors.New("not connected to Moshtty app")
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	id := fmt.Sprintf("app-%d", s.nextAppID.Add(1))
	ch := make(chan appResponse, 1)
	state.mu.Lock()
	state.pending[id] = ch
	state.mu.Unlock()

	req := jsonrpc.Request{
		JSONRPC: jsonrpc.Version,
		ID:      json.RawMessage(strconv.Quote(id)),
		Method:  method,
		Params:  params,
	}
	if err := state.writeJSON(req); err != nil {
		state.mu.Lock()
		delete(state.pending, id)
		state.mu.Unlock()
		return nil, err
	}

	select {
	case <-ctx.Done():
		state.mu.Lock()
		delete(state.pending, id)
		state.mu.Unlock()
		return nil, ctx.Err()
	case response := <-ch:
		if response.err != nil {
			return nil, response.err
		}
		if len(response.result) == 0 {
			return map[string]any{"ok": true}, nil
		}
		var result any
		if err := json.Unmarshal(response.result, &result); err != nil {
			return nil, fmt.Errorf("decode app response: %w", err)
		}
		return result, nil
	}
}

func (state *sessionState) writeJSON(value any) error {
	state.writeMu.Lock()
	defer state.writeMu.Unlock()
	if state.encoder == nil {
		return errors.New("app control stream is not connected")
	}
	return state.encoder.Encode(value)
}

func (state *sessionState) resolveResponse(msg controlMessage) {
	var id string
	if err := json.Unmarshal(msg.ID, &id); err != nil {
		id = string(msg.ID)
	}
	state.mu.Lock()
	ch := state.pending[id]
	delete(state.pending, id)
	state.mu.Unlock()
	if ch == nil {
		return
	}
	if msg.Error != nil {
		ch <- appResponse{err: fmt.Errorf("app error: %s", msg.Error.Message)}
		return
	}
	ch <- appResponse{result: msg.Result}
}

func (state *sessionState) closePending(err error) {
	state.mu.Lock()
	pending := state.pending
	state.pending = make(map[string]chan appResponse)
	state.mu.Unlock()
	for _, ch := range pending {
		ch <- appResponse{err: err}
	}
}

func (s *Server) UpdateCertificate(cert tls.Certificate) {
	s.certMu.Lock()
	defer s.certMu.Unlock()
	s.cert = &cert
}

func (s *Server) getActiveCertificate() *tls.Certificate {
	s.certMu.RLock()
	defer s.certMu.RUnlock()
	return s.cert
}

func (s *Server) GetActiveCertificate() *tls.Certificate {
	return s.getActiveCertificate()
}

func (s *Server) UpdateConfig(cfg config.Config) {
	s.cfgMu.Lock()
	defer s.cfgMu.Unlock()
	s.cfg = cfg
}
