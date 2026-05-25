package profile

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/moshtty/moshtty/internal/config"
)

const Version = "0.1.0"
const SchemaVersion = 1

type Defaults struct {
	Cols      int    `json:"cols"`
	Rows      int    `json:"rows"`
	ShellHint string `json:"shellHint,omitempty"`
}

type ImportProfile struct {
	SchemaVersion   int       `json:"schemaVersion"`
	RemoteID        string    `json:"remoteId"`
	HostLabel       string    `json:"hostLabel"`
	Host            string    `json:"host"`
	Platform        string    `json:"platform"`
	URL             string    `json:"url"`
	Token           string    `json:"token"`
	TokenLabel      string    `json:"tokenLabel"`
	CurrentCertHash string    `json:"currentCertHash"`
	NextCertHash    string    `json:"nextCertHash,omitempty"`
	ServiceVersion  string    `json:"serviceVersion"`
	Defaults        Defaults  `json:"defaults"`
	AllowedOrigins  []string  `json:"allowedOrigins,omitempty"`
	GeneratedAt     time.Time `json:"generatedAt"`
}

type BuildInput struct {
	Config config.Config
	Token  string
	Host   string
	Now    time.Time
}

func Build(input BuildInput) ImportProfile {
	host := input.Host
	if host == "" {
		host = "localhost"
	}
	now := input.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}

	profile := ImportProfile{
		SchemaVersion:   SchemaVersion,
		RemoteID:        input.Config.RemoteID,
		HostLabel:       input.Config.Label,
		Host:            host,
		Platform:        "macos",
		URL:             input.Config.WebTransportURL(host),
		Token:           input.Token,
		TokenLabel:      input.Config.Token.Label,
		CurrentCertHash: input.Config.Cert.CurrentHash,
		NextCertHash:    input.Config.Cert.NextHash,
		ServiceVersion:  Version,
		Defaults: Defaults{
			Cols: 120,
			Rows: 32,
		},
		AllowedOrigins: append([]string(nil), input.Config.AllowedOrigins...),
		GeneratedAt:    now,
	}
	return profile
}

func Marshal(profile ImportProfile) ([]byte, error) {
	data, err := json.MarshalIndent(profile, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode profile: %w", err)
	}
	return append(data, '\n'), nil
}

func Format(input BuildInput) (string, error) {
	data, err := Marshal(Build(input))
	if err != nil {
		return "", err
	}
	return string(data), nil
}
