package auth

import (
	"errors"
	"net/http"
	"strings"
)

var (
	ErrMissingToken = errors.New("missing auth token")
	ErrInvalidToken = errors.New("invalid auth token")
	ErrInvalidOrigin = errors.New("invalid origin")
)

const TokenHeader = "X-Moshtty-Token"

func ValidateToken(provided, expected string) error {
	if expected == "" {
		return errors.New("expected token is not configured")
	}
	if provided == "" {
		return ErrMissingToken
	}
	if provided != expected {
		return ErrInvalidToken
	}
	return nil
}

func TokenFromRequest(r *http.Request) string {
	if token := strings.TrimSpace(r.Header.Get(TokenHeader)); token != "" {
		return token
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
}

func OriginAllowed(origin string, allowed []string) bool {
	if origin == "" {
		return false
	}
	for _, candidate := range allowed {
		if origin == candidate {
			return true
		}
	}
	return false
}

func ValidateOrigin(origin string, allowed []string) error {
	if OriginAllowed(origin, allowed) {
		return nil
	}
	return ErrInvalidOrigin
}

func NewOriginChecker(allowed []string) func(*http.Request) bool {
	allowedCopy := append([]string(nil), allowed...)
	return func(r *http.Request) bool {
		return OriginAllowed(r.Header.Get("Origin"), allowedCopy)
	}
}
