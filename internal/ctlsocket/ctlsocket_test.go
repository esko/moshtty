package ctlsocket

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/moshtty/moshtty/internal/jsonrpc"
)

func TestServerStaleSocketCleanup(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "ctlsocket-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	socketPath := filepath.Join(tmpDir, "stale.sock")

	// Pre-create a file at socket path to simulate a stale socket
	if err := os.WriteFile(socketPath, []byte("stale data"), 0600); err != nil {
		t.Fatalf("failed to write stale file: %v", err)
	}

	handler := func(req jsonrpc.Request) (any, error) {
		return "ok", nil
	}

	server := NewServer(socketPath, handler)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Listen(ctx)
	}()

	// Wait a bit to ensure listener is running
	time.Sleep(50 * time.Millisecond)

	// Verify socket file was created successfully
	if _, err := os.Stat(socketPath); os.IsNotExist(err) {
		t.Errorf("socket file was not created")
	}

	cancel()
	err = <-errCh
	if err != nil {
		t.Errorf("expected no error on close, got: %v", err)
	}
}

func TestHappyPathDialAndCall(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "ctlsocket-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	socketPath := filepath.Join(tmpDir, "test.sock")

	handler := func(req jsonrpc.Request) (any, error) {
		if req.Method == "ping" {
			return "pong", nil
		}
		if req.Method == "error" {
			return nil, errors.New("something went wrong")
		}
		return nil, jsonrpc.ErrMethodNotFound
	}

	server := NewServer(socketPath, handler)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Listen(ctx)
	}()

	// Wait a bit to ensure listener is running
	time.Sleep(50 * time.Millisecond)

	client, err := Dial(ctx, socketPath)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer func() { _ = client.Close() }()

	// Call 1: Ping (success)
	res, err := client.Call(ctx, "ping", nil)
	if err != nil {
		t.Fatalf("ping call failed: %v", err)
	}
	var pong string
	if err := json.Unmarshal(res, &pong); err != nil {
		t.Fatalf("failed to unmarshal ping result: %v", err)
	}
	if pong != "pong" {
		t.Errorf("got %q, want %q", pong, "pong")
	}

	// Call 2: Error (failure)
	_, err = client.Call(ctx, "error", nil)
	if err == nil {
		t.Error("expected error call to fail, but it succeeded")
	} else if err.Error() != "rpc error: code -32603, message something went wrong" {
		t.Errorf("unexpected error message: %v", err)
	}

	// Call 3: Method Not Found (failure)
	_, err = client.Call(ctx, "unknown", nil)
	if err == nil {
		t.Error("expected unknown call to fail, but it succeeded")
	} else if err.Error() != "rpc error: code -32601, message method not found" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestConnectionFailure(t *testing.T) {
	ctx := context.Background()
	_, err := Dial(ctx, "/path/to/nonexistent/socket.sock")
	if err == nil {
		t.Fatal("expected dial to fail, but it succeeded")
	}

	expectedErr := "moshtty-remote not running — start it with moshtty-remote run"
	if err.Error() != expectedErr {
		t.Errorf("got error %q, want %q", err.Error(), expectedErr)
	}
}

func TestConcurrentCalls(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "ctlsocket-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	socketPath := filepath.Join(tmpDir, "concurrent.sock")

	handler := func(req jsonrpc.Request) (any, error) {
		var num int
		if err := json.Unmarshal(req.Params, &num); err != nil {
			return nil, err
		}
		return num * 2, nil
	}

	server := NewServer(socketPath, handler)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Listen(ctx)
	}()

	time.Sleep(50 * time.Millisecond)

	client, err := Dial(ctx, socketPath)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer func() { _ = client.Close() }()

	var wg sync.WaitGroup
	const numGoroutines = 10
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(val int) {
			defer wg.Done()
			res, err := client.Call(ctx, "double", val)
			if err != nil {
				t.Errorf("call failed: %v", err)
				return
			}
			var doubled int
			if err := json.Unmarshal(res, &doubled); err != nil {
				t.Errorf("failed to unmarshal: %v", err)
				return
			}
			if doubled != val*2 {
				t.Errorf("got %d, want %d", doubled, val*2)
			}
		}(i)
	}
	wg.Wait()
}
