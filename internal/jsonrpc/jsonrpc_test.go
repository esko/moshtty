package jsonrpc_test

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/moshtty/moshtty/internal/jsonrpc"
)

func TestParseRequest(t *testing.T) {
	req, err := jsonrpc.ParseRequest([]byte(`{"jsonrpc":"2.0","id":1,"method":"health","params":{}}`))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if req.Method != "health" {
		t.Fatalf("method = %q", req.Method)
	}
}

func TestParseRequestErrors(t *testing.T) {
	_, err := jsonrpc.ParseRequest([]byte(`{"jsonrpc":"1.0","method":"health"}`))
	if !errors.Is(err, jsonrpc.ErrInvalidRequest) {
		t.Fatalf("err = %v", err)
	}
}

func TestErrorResponse(t *testing.T) {
	resp := jsonrpc.NewErrorResponse(json.RawMessage(`1`), jsonrpc.CodeMethodNotFound, "missing", nil)
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if string(data) == "" {
		t.Fatal("expected json")
	}
}

func TestErrorCode(t *testing.T) {
	if jsonrpc.ErrorCode(jsonrpc.ErrMethodNotFound) != jsonrpc.CodeMethodNotFound {
		t.Fatal("expected method not found code")
	}
}
