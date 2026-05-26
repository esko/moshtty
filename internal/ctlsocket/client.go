package ctlsocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/moshtty/moshtty/internal/jsonrpc"
)

type Client struct {
	conn      net.Conn
	encoder   *json.Encoder
	decoder   *json.Decoder
	requestID int64
	mu        sync.Mutex
}

func Dial(ctx context.Context, path string) (*Client, error) {
	var d net.Dialer
	conn, err := d.DialContext(ctx, "unix", path)
	if err != nil {
		return nil, fmt.Errorf("moshtty-remote not running — start it with moshtty-remote run")
	}

	return &Client{
		conn:    conn,
		encoder: json.NewEncoder(conn),
		decoder: json.NewDecoder(conn),
	}, nil
}

func (c *Client) Call(ctx context.Context, method string, params any) (json.RawMessage, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	reqID := atomic.AddInt64(&c.requestID, 1)
	idBytes, err := json.Marshal(reqID)
	if err != nil {
		return nil, fmt.Errorf("marshal request id: %w", err)
	}

	var paramsBytes json.RawMessage
	if params != nil {
		pb, err := json.Marshal(params)
		if err != nil {
			return nil, fmt.Errorf("marshal params: %w", err)
		}
		paramsBytes = pb
	}

	req := jsonrpc.Request{
		JSONRPC: jsonrpc.Version,
		ID:      idBytes,
		Method:  method,
		Params:  paramsBytes,
	}

	if dl, ok := ctx.Deadline(); ok {
		_ = c.conn.SetDeadline(dl)
	} else {
		_ = c.conn.SetDeadline(time.Time{})
	}

	if err := c.encoder.Encode(req); err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}

	type clientResponse struct {
		JSONRPC string               `json:"jsonrpc"`
		ID      json.RawMessage      `json:"id,omitempty"`
		Result  json.RawMessage      `json:"result,omitempty"`
		Error   *jsonrpc.ErrorObject `json:"error,omitempty"`
	}

	var resp clientResponse
	if err := c.decoder.Decode(&resp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if string(resp.ID) != string(idBytes) {
		return nil, fmt.Errorf("mismatch response ID: got %s, want %s", string(resp.ID), string(idBytes))
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("rpc error: code %d, message %s", resp.Error.Code, resp.Error.Message)
	}

	return resp.Result, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}
