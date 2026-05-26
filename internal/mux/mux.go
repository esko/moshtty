package mux

import (
	"encoding/binary"
	"errors"
	"fmt"
)

const (
	Version1   = 1
	HeaderSize = 5
)

var (
	ErrShortFrame      = errors.New("mux frame too short")
	ErrUnknownVersion  = errors.New("unknown mux version")
	ErrEmptyPayload    = errors.New("mux payload must not be empty")
	ErrPayloadTooLarge = errors.New("mux payload exceeds maximum size")
)

const MaxPayloadSize = 16 * 1024

type Frame struct {
	Version uint8
	FlowID  uint32
	Payload []byte
}

func Encode(frame Frame) ([]byte, error) {
	if frame.Version == 0 {
		frame.Version = Version1
	}
	if frame.Version != Version1 {
		return nil, fmt.Errorf("%w: %d", ErrUnknownVersion, frame.Version)
	}
	if len(frame.Payload) == 0 {
		return nil, ErrEmptyPayload
	}
	if len(frame.Payload) > MaxPayloadSize {
		return nil, ErrPayloadTooLarge
	}

	out := make([]byte, HeaderSize+len(frame.Payload))
	out[0] = frame.Version
	binary.BigEndian.PutUint32(out[1:5], frame.FlowID)
	copy(out[HeaderSize:], frame.Payload)
	return out, nil
}

func Decode(data []byte) (Frame, error) {
	if len(data) < HeaderSize {
		return Frame{}, ErrShortFrame
	}
	version := data[0]
	if version != Version1 {
		return Frame{}, fmt.Errorf("%w: %d", ErrUnknownVersion, version)
	}
	flowID := binary.BigEndian.Uint32(data[1:5])
	payload := data[HeaderSize:]
	if len(payload) == 0 {
		return Frame{}, ErrEmptyPayload
	}
	if len(payload) > MaxPayloadSize {
		return Frame{}, ErrPayloadTooLarge
	}
	return Frame{
		Version: version,
		FlowID:  flowID,
		Payload: append([]byte(nil), payload...),
	}, nil
}
