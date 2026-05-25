package wtserver

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/moshtty/moshtty/internal/certs"
	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/jsonrpc"
)

func TestDispatchHealth(t *testing.T) {
	srv := newTestServer(t)
	result, err := srv.dispatch(jsonrpc.Request{
		JSONRPC: jsonrpc.Version,
		ID:      json.RawMessage(`1`),
		Method:  "health",
	})
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	payload, ok := result.(map[string]any)
	if !ok || payload["status"] != "ok" {
		t.Fatalf("result = %#v", result)
	}
}

func TestDispatchPaneCreateClose(t *testing.T) {
	srv := newTestServer(t)
	srv.panes.SetDatagramSender(func([]byte) error { return nil })

	createResult, err := srv.dispatch(jsonrpc.Request{
		JSONRPC: jsonrpc.Version,
		ID:      json.RawMessage(`2`),
		Method:  "pane.create",
		Params:  json.RawMessage(`{"shell":"/bin/sh","cols":80,"rows":24}`),
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	flowID := extractFlowID(t, createResult)
	_, err = srv.dispatch(jsonrpc.Request{
		JSONRPC: jsonrpc.Version,
		ID:      json.RawMessage(`3`),
		Method:  "pane.close",
		Params:  mustJSON(t, map[string]any{"flowId": flowID}),
	})
	if err != nil {
		t.Fatalf("close: %v", err)
	}
}

func TestDispatchUnknownMethod(t *testing.T) {
	srv := newTestServer(t)
	_, err := srv.dispatch(jsonrpc.Request{
		JSONRPC: jsonrpc.Version,
		Method:  "missing.method",
	})
	if !errors.Is(err, jsonrpc.ErrMethodNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	path := filepath.Join(t.TempDir(), "current.pem")
	cert, err := certs.GenerateDefault(time.Now().UTC())
	if err != nil {
		t.Fatalf("generate cert: %v", err)
	}
	if err := certs.SavePEM(path, cert); err != nil {
		t.Fatalf("save cert: %v", err)
	}
	tlsCert, err := certs.LoadTLSCertificate(path)
	if err != nil {
		t.Fatalf("load cert: %v", err)
	}
	cfg := config.DefaultConfig("remote-test")
	srv, err := New(Options{
		Config: cfg,
		Token:  "secret",
		Cert:   tlsCert,
	})
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	return srv
}

func extractFlowID(t *testing.T, result any) uint32 {
	t.Helper()
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var info struct {
		FlowID uint32 `json:"flowId"`
	}
	if err := json.Unmarshal(data, &info); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if info.FlowID == 0 {
		t.Fatal("expected flow id")
	}
	return info.FlowID
}

func mustJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return data
}
