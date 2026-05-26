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
	"sync"

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
	cfg    config.Config
	token  string
	panes  *pane.Manager
	wt     webtransport.Server
	udpLn  *net.UDPConn
	mu     sync.Mutex
	closed bool

	sessionMu sync.Mutex
	session   *webtransport.Session
}

func New(opts Options) (*Server, error) {
	if opts.Token == "" {
		return nil, errors.New("token is required")
	}

	tlsConf := &tls.Config{
		Certificates: []tls.Certificate{opts.Cert},
		NextProtos:   []string{http3.NextProtoH3},
	}

	s := &Server{
		cfg:   opts.Config,
		token: opts.Token,
		panes: pane.NewManager(),
		wt: webtransport.Server{
			H3: &http3.Server{
				TLSConfig: tlsConf,
			},
			CheckOrigin: auth.NewOriginChecker(opts.Config.AllowedOrigins),
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
	if err := auth.ValidateOrigin(r.Header.Get("Origin"), s.cfg.AllowedOrigins); err != nil {
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
}

func (s *Server) serveSession(session *webtransport.Session) {
	s.sessionMu.Lock()
	s.session = session
	s.sessionMu.Unlock()
	defer func() {
		s.sessionMu.Lock()
		if s.session == session {
			s.session = nil
		}
		s.sessionMu.Unlock()
		_ = session.CloseWithError(0, "")
	}()

	state := &sessionState{session: session}

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
	encoder := json.NewEncoder(stream)

	for {
		var req jsonrpc.Request
		if err := decoder.Decode(&req); err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			resp := jsonrpc.NewErrorResponse(nil, jsonrpc.CodeParseError, err.Error(), nil)
			_ = encoder.Encode(resp)
			return
		}

		result, err := s.Dispatch(req)
		if err != nil {
			resp := jsonrpc.NewErrorResponse(req.ID, jsonrpc.ErrorCode(err), err.Error(), nil)
			_ = encoder.Encode(resp)
			continue
		}
		resp := jsonrpc.NewResultResponse(req.ID, result)
		_ = encoder.Encode(resp)
	}
}

// Dispatch exposes the JSON-RPC dispatch logic.
func (s *Server) Dispatch(req jsonrpc.Request) (any, error) {
	return s.dispatch(req)
}

func (s *Server) dispatch(req jsonrpc.Request) (any, error) {
	switch req.Method {
	case "health":
		return map[string]any{
			"status":         "ok",
			"remoteId":       s.cfg.RemoteID,
			"serviceVersion": profile.Version,
			"bindEndpoint":   s.cfg.BindEndpoint(),
		}, nil
	case "pane.list":
		return map[string]any{"panes": s.panes.List()}, nil
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
	session := s.session
	s.sessionMu.Unlock()
	if session == nil {
		return errors.New("no active webtransport session")
	}
	return session.SendDatagram(data)
}
