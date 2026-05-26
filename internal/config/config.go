package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const (
	CurrentVersion       = 1
	DefaultBindAddress   = "0.0.0.0"
	DefaultPort          = 4433
	DefaultHealthAddress = "127.0.0.1"
	DefaultHealthPort    = 4434
	DefaultTokenLabel    = "default"
	DefaultRemoteLabel   = "My Mac"
)

var DefaultAllowedOrigins = []string{"app://moshtty"}

type TokenMetadata struct {
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"createdAt"`
}

type CertMetadata struct {
	CurrentPath  string    `json:"currentPath"`
	NextPath     string    `json:"nextPath,omitempty"`
	CurrentHash  string    `json:"currentHash"`
	NextHash     string    `json:"nextHash,omitempty"`
	NotAfter     time.Time `json:"notAfter"`
	NextNotAfter time.Time `json:"nextNotAfter,omitempty"`
}

type Config struct {
	Version        int           `json:"version"`
	RemoteID       string        `json:"remoteId"`
	Label          string        `json:"label"`
	BindAddress    string        `json:"bindAddress"`
	Port           int           `json:"port"`
	HealthAddress  string        `json:"healthAddress"`
	HealthPort     int           `json:"healthPort"`
	AllowedOrigins []string      `json:"allowedOrigins"`
	Token          TokenMetadata `json:"token"`
	Cert           CertMetadata  `json:"cert"`
}

func DefaultConfig(remoteID string) Config {
	now := time.Now().UTC()
	return Config{
		Version:        CurrentVersion,
		RemoteID:       remoteID,
		Label:          DefaultRemoteLabel,
		BindAddress:    DefaultBindAddress,
		Port:           DefaultPort,
		HealthAddress:  DefaultHealthAddress,
		HealthPort:     DefaultHealthPort,
		AllowedOrigins: append([]string(nil), DefaultAllowedOrigins...),
		Token: TokenMetadata{
			Label:     DefaultTokenLabel,
			CreatedAt: now,
		},
	}
}

func (c Config) BindEndpoint() string {
	return fmt.Sprintf("%s:%d", c.BindAddress, c.Port)
}

func (c Config) HealthEndpoint() string {
	return fmt.Sprintf("%s:%d", c.HealthAddress, c.HealthPort)
}

func (c Config) WebTransportURL(host string) string {
	if host == "" {
		host = "localhost"
	}
	return fmt.Sprintf("https://%s:%d", host, c.Port)
}

func Load(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("decode config: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) Validate() error {
	if c.Version != CurrentVersion {
		return fmt.Errorf("unsupported config version %d", c.Version)
	}
	if c.RemoteID == "" {
		return errors.New("remoteId is required")
	}
	if c.BindAddress == "" {
		return errors.New("bindAddress is required")
	}
	if c.Port <= 0 || c.Port > 65535 {
		return fmt.Errorf("invalid port %d", c.Port)
	}
	if c.HealthPort <= 0 || c.HealthPort > 65535 {
		return fmt.Errorf("invalid healthPort %d", c.HealthPort)
	}
	if len(c.AllowedOrigins) == 0 {
		return errors.New("allowedOrigins must not be empty")
	}
	return nil
}

func Save(path string, cfg Config) error {
	if err := cfg.Validate(); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("encode config: %w", err)
	}
	data = append(data, '\n')
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write config temp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename config: %w", err)
	}
	return nil
}
