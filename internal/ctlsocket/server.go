package ctlsocket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"

	"github.com/moshtty/moshtty/internal/jsonrpc"
)

type Handler func(req jsonrpc.Request) (any, error)

type Server struct {
	path     string
	listener net.Listener
	handler  Handler
	mu       sync.Mutex
	closed   bool
}

func NewServer(path string, handler Handler) *Server {
	return &Server{
		path:    path,
		handler: handler,
	}
}

func (s *Server) Listen(ctx context.Context) error {
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("create socket directory: %w", err)
	}

	// Clean up stale socket file if it exists
	if err := os.Remove(s.path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove stale socket: %w", err)
	}

	l, err := net.Listen("unix", s.path)
	if err != nil {
		return fmt.Errorf("listen unix socket: %w", err)
	}

	s.mu.Lock()
	if s.closed {
		l.Close()
		s.mu.Unlock()
		return net.ErrClosed
	}
	s.listener = l
	s.mu.Unlock()

	defer s.Close()

	// Watch for context cancellation
	doneCh := make(chan struct{})
	defer close(doneCh)
	go func() {
		select {
		case <-ctx.Done():
			s.Close()
		case <-doneCh:
		}
	}()

	for {
		conn, err := l.Accept()
		if err != nil {
			s.mu.Lock()
			closed := s.closed
			s.mu.Unlock()
			if closed {
				return nil
			}
			return err
		}
		go s.serveConn(conn)
	}
}

func (s *Server) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true

	var err error
	if s.listener != nil {
		err = s.listener.Close()
	}
	_ = os.Remove(s.path)
	return err
}

func (s *Server) serveConn(conn net.Conn) {
	defer conn.Close()
	decoder := json.NewDecoder(conn)
	encoder := json.NewEncoder(conn)

	for {
		var req jsonrpc.Request
		if err := decoder.Decode(&req); err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			// Respond with parse error if there was a decode problem
			resp := jsonrpc.NewErrorResponse(nil, jsonrpc.CodeParseError, err.Error(), nil)
			_ = encoder.Encode(resp)
			return
		}

		result, err := s.handler(req)
		if err != nil {
			resp := jsonrpc.NewErrorResponse(req.ID, jsonrpc.ErrorCode(err), err.Error(), nil)
			_ = encoder.Encode(resp)
			continue
		}
		resp := jsonrpc.NewResultResponse(req.ID, result)
		_ = encoder.Encode(resp)
	}
}
