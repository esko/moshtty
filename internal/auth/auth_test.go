package auth_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/moshtty/moshtty/internal/auth"
)

func TestValidateToken(t *testing.T) {
	tests := []struct {
		name     string
		provided string
		expected string
		wantErr  error
	}{
		{name: "valid", provided: "secret", expected: "secret"},
		{name: "missing", provided: "", expected: "secret", wantErr: auth.ErrMissingToken},
		{name: "invalid", provided: "wrong", expected: "secret", wantErr: auth.ErrInvalidToken},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := auth.ValidateToken(tt.provided, tt.expected)
			if tt.wantErr == nil && err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v want %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateOrigin(t *testing.T) {
	allowed := []string{"app://moshtty", "http://localhost:5173"}
	tests := []struct {
		name   string
		origin string
		ok     bool
	}{
		{name: "app origin", origin: "app://moshtty", ok: true},
		{name: "dev origin", origin: "http://localhost:5173", ok: true},
		{name: "blocked", origin: "https://evil.test", ok: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := auth.ValidateOrigin(tt.origin, allowed)
			if tt.ok && err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if !tt.ok && !errors.Is(err, auth.ErrInvalidOrigin) {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestTokenFromRequest(t *testing.T) {
	req := http.Request{Header: http.Header{}}
	req.Header.Set(auth.TokenHeader, "header-token")
	if got := auth.TokenFromRequest(&req); got != "header-token" {
		t.Fatalf("header token = %q", got)
	}

	req = http.Request{Header: http.Header{}}
	req.Header.Set("Authorization", "Bearer bearer-token")
	if got := auth.TokenFromRequest(&req); got != "bearer-token" {
		t.Fatalf("bearer token = %q", got)
	}
}
