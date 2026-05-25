package config_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/moshtty/moshtty/internal/config"
)

func TestDefaultConfig(t *testing.T) {
	got := config.DefaultConfig("remote-test")

	if got.Version != config.CurrentVersion {
		t.Fatalf("version = %d", got.Version)
	}
	if got.RemoteID != "remote-test" {
		t.Fatalf("remote id = %q", got.RemoteID)
	}
	if got.BindAddress != config.DefaultBindAddress {
		t.Fatalf("bind address = %q", got.BindAddress)
	}
	if got.Port != config.DefaultPort {
		t.Fatalf("port = %d", got.Port)
	}
	if got.HealthAddress != config.DefaultHealthAddress {
		t.Fatalf("health address = %q", got.HealthAddress)
	}
	if got.HealthPort != config.DefaultHealthPort {
		t.Fatalf("health port = %d", got.HealthPort)
	}
	if len(got.AllowedOrigins) != len(config.DefaultAllowedOrigins) {
		t.Fatalf("allowed origins = %#v", got.AllowedOrigins)
	}
	if got.Token.Label != config.DefaultTokenLabel {
		t.Fatalf("token label = %q", got.Token.Label)
	}
	if got.BindEndpoint() != "0.0.0.0:4433" {
		t.Fatalf("bind endpoint = %q", got.BindEndpoint())
	}
	if got.WebTransportURL("mac.local") != "https://mac.local:4433" {
		t.Fatalf("url = %q", got.WebTransportURL("mac.local"))
	}
}

func TestConfigSaveLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")

	cfg := config.DefaultConfig("remote-save-load")
	cfg.Cert.CurrentHash = "abc"
	cfg.Cert.CurrentPath = filepath.Join(dir, "current.pem")
	cfg.Token.CreatedAt = time.Date(2026, 5, 25, 12, 0, 0, 0, time.UTC)

	if err := config.Save(path, cfg); err != nil {
		t.Fatalf("save: %v", err)
	}

	loaded, err := config.Load(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if loaded.RemoteID != cfg.RemoteID {
		t.Fatalf("remote id = %q", loaded.RemoteID)
	}
	if loaded.Cert.CurrentHash != "abc" {
		t.Fatalf("cert hash = %q", loaded.Cert.CurrentHash)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if info.Mode().Perm()&0o077 != 0 {
		t.Fatalf("config permissions too open: %o", info.Mode().Perm())
	}
}

func TestGenerateToken(t *testing.T) {
	tests := []struct {
		name string
	}{
		{name: "first"},
		{name: "second"},
	}

	seen := map[string]struct{}{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := config.GenerateToken()
			if err != nil {
				t.Fatalf("generate: %v", err)
			}
			if len(token) < 32 {
				t.Fatalf("token too short: %q", token)
			}
			if _, ok := seen[token]; ok {
				t.Fatalf("duplicate token generated")
			}
			seen[token] = struct{}{}
		})
	}
}

func TestSaveLoadToken(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "token")

	token, err := config.GenerateToken()
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if err := config.SaveToken(path, token); err != nil {
		t.Fatalf("save: %v", err)
	}
	loaded, err := config.LoadToken(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if loaded != token {
		t.Fatalf("token mismatch")
	}
}
