package pane_test

import (
	"errors"
	"testing"

	"github.com/moshtty/moshtty/internal/mux"
	"github.com/moshtty/moshtty/internal/pane"
)

func TestPaneLifecycle(t *testing.T) {
	manager := pane.NewManager()
	var sent [][]byte
	manager.SetDatagramSender(func(data []byte) error {
		sent = append(sent, append([]byte(nil), data...))
		return nil
	})

	info, err := manager.Create(pane.CreateOptions{Shell: "/bin/sh", Cols: 80, Rows: 24})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if info.FlowID == 0 || info.Key == "" {
		t.Fatalf("info = %+v", info)
	}

	attached, err := manager.Attach(info.FlowID)
	if err != nil {
		t.Fatalf("attach: %v", err)
	}
	if attached.Key != info.Key {
		t.Fatalf("attach key mismatch")
	}

	if err := manager.Resize(info.FlowID, 100, 40); err != nil {
		t.Fatalf("resize: %v", err)
	}

	frame, err := mux.Encode(mux.Frame{
		FlowID:  info.FlowID,
		Payload: []byte("probe"),
	})
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if err := manager.RouteOutbound(frame); err != nil {
		t.Fatalf("route outbound: %v", err)
	}

	if err := manager.Close(info.FlowID); err != nil {
		t.Fatalf("close: %v", err)
	}
	if _, err := manager.Attach(info.FlowID); !errors.Is(err, pane.ErrUnknownFlow) {
		t.Fatalf("attach after close = %v", err)
	}
	_ = sent
}

func TestRouteUnknownFlow(t *testing.T) {
	manager := pane.NewManager()
	frame, err := mux.Encode(mux.Frame{FlowID: 99, Payload: []byte("x")})
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if err := manager.RouteOutbound(frame); !errors.Is(err, pane.ErrUnknownFlow) {
		t.Fatalf("err = %v", err)
	}
}
