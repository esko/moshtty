package mux_test

import (
	"errors"
	"testing"

	"github.com/moshtty/moshtty/internal/mux"
)

func TestEncodeDecode(t *testing.T) {
	tests := []struct {
		name  string
		frame mux.Frame
	}{
		{
			name: "basic frame",
			frame: mux.Frame{
				FlowID:  42,
				Payload: []byte("mosh-datagram"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded, err := mux.Encode(tt.frame)
			if err != nil {
				t.Fatalf("encode: %v", err)
			}
			decoded, err := mux.Decode(encoded)
			if err != nil {
				t.Fatalf("decode: %v", err)
			}
			if decoded.Version != mux.Version1 {
				t.Fatalf("version = %d", decoded.Version)
			}
			if decoded.FlowID != tt.frame.FlowID {
				t.Fatalf("flow id = %d", decoded.FlowID)
			}
			if string(decoded.Payload) != string(tt.frame.Payload) {
				t.Fatalf("payload = %q", decoded.Payload)
			}
		})
	}
}

func TestDecodeErrors(t *testing.T) {
	tests := []struct {
		name string
		data []byte
		want error
	}{
		{name: "short frame", data: []byte{1, 0, 0, 0}, want: mux.ErrShortFrame},
		{name: "unknown version", data: []byte{2, 0, 0, 0, 1, 0x01}, want: mux.ErrUnknownVersion},
		{name: "empty payload", data: []byte{1, 0, 0, 0, 1}, want: mux.ErrEmptyPayload},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := mux.Decode(tt.data)
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v want %v", err, tt.want)
			}
		})
	}
}
