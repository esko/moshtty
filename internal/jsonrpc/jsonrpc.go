package jsonrpc

import (
	"encoding/json"
	"errors"
	"fmt"
)

const Version = "2.0"

var (
	ErrInvalidRequest = errors.New("invalid jsonrpc request")
	ErrMethodNotFound = errors.New("method not found")
	ErrInvalidParams  = errors.New("invalid params")
	ErrInternal       = errors.New("internal error")
)

type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  any             `json:"result,omitempty"`
	Error   *ErrorObject    `json:"error,omitempty"`
}

type ErrorObject struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

const (
	CodeParseError     = -32700
	CodeInvalidRequest = -32600
	CodeMethodNotFound = -32601
	CodeInvalidParams  = -32602
	CodeInternalError  = -32603
)

func ParseRequest(data []byte) (Request, error) {
	var req Request
	if err := json.Unmarshal(data, &req); err != nil {
		return Request{}, fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if req.JSONRPC != Version || req.Method == "" {
		return Request{}, ErrInvalidRequest
	}
	return req, nil
}

func NewErrorResponse(id json.RawMessage, code int, message string, data any) Response {
	return Response{
		JSONRPC: Version,
		ID:      id,
		Error: &ErrorObject{
			Code:    code,
			Message: message,
			Data:    data,
		},
	}
}

func NewResultResponse(id json.RawMessage, result any) Response {
	return Response{
		JSONRPC: Version,
		ID:      id,
		Result:  result,
	}
}

func MarshalResponse(resp Response) ([]byte, error) {
	return json.Marshal(resp)
}

func ErrorCode(err error) int {
	switch {
	case errors.Is(err, ErrMethodNotFound):
		return CodeMethodNotFound
	case errors.Is(err, ErrInvalidParams):
		return CodeInvalidParams
	case errors.Is(err, ErrInvalidRequest):
		return CodeInvalidRequest
	default:
		return CodeInternalError
	}
}
