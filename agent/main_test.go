package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSanitizeSize(t *testing.T) {
	cols, rows, err := sanitizeSize(120, 32)
	if err != nil {
		t.Fatalf("expected valid size: %v", err)
	}
	if cols != 120 || rows != 32 {
		t.Fatalf("unexpected size %dx%d", cols, rows)
	}

	for _, tc := range []struct {
		cols int
		rows int
	}{
		{0, 24},
		{80, 0},
		{501, 24},
		{80, 201},
	} {
		if _, _, err := sanitizeSize(tc.cols, tc.rows); err == nil {
			t.Fatalf("expected invalid size %dx%d", tc.cols, tc.rows)
		}
	}
}

func TestTokenValidation(t *testing.T) {
	srv := &server{cfg: config{token: "abc"}}
	req := httptest.NewRequest(http.MethodGet, "/pty?token=abc", nil)
	if !srv.validToken(req) {
		t.Fatal("query token should be accepted")
	}

	req = httptest.NewRequest(http.MethodGet, "/pty", nil)
	req.Header.Set("Authorization", "Bearer abc")
	if !srv.validToken(req) {
		t.Fatal("authorization token should be accepted")
	}

	req = httptest.NewRequest(http.MethodGet, "/pty?token=wrong", nil)
	if srv.validToken(req) {
		t.Fatal("wrong token should be rejected")
	}
}

func TestOriginValidation(t *testing.T) {
	srv := &server{cfg: config{allowHost: "127.0.0.1:8765"}}

	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8765/pty", nil)
	req.Host = "127.0.0.1:8765"
	req.Header.Set("Origin", "http://127.0.0.1:8765")
	if !srv.validRequestOrigin(req) {
		t.Fatal("same origin should be accepted")
	}

	req = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8765/pty", nil)
	req.Host = "evil.test"
	if srv.validRequestOrigin(req) {
		t.Fatal("unexpected host should be rejected")
	}

	req = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8765/pty", nil)
	req.Host = "127.0.0.1:8765"
	req.Header.Set("Origin", "https://evil.test")
	if srv.validRequestOrigin(req) {
		t.Fatal("unexpected origin should be rejected")
	}
}
