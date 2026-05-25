package profile_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/profile"
)

func TestProfileJSONShape(t *testing.T) {
	now := time.Date(2026, 5, 25, 15, 0, 0, 0, time.UTC)
	cfg := config.DefaultConfig("remote-profile-1")
	cfg.Label = "Office Mac"
	cfg.Cert.CurrentHash = "current-hash"
	cfg.Cert.NextHash = "next-hash"

	tests := []struct {
		name  string
		input profile.BuildInput
	}{
		{
			name: "full profile",
			input: profile.BuildInput{
				Config: cfg,
				Token:  "secret-token",
				Host:   "macbook.local",
				Now:    now,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := profile.Marshal(profile.Build(tt.input))
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}

			var decoded map[string]any
			if err := json.Unmarshal(data, &decoded); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}

			required := []string{
				"id", "label", "host", "platform", "url", "token", "tokenLabel",
				"currentCertHash", "nextCertHash", "serviceVersion", "defaults", "generatedAt",
			}
			for _, key := range required {
				if _, ok := decoded[key]; !ok {
					t.Fatalf("missing key %q in %s", key, string(data))
				}
			}

			if decoded["id"] != "remote-profile-1" {
				t.Fatalf("id = %v", decoded["id"])
			}
			if decoded["platform"] != "macos" {
				t.Fatalf("platform = %v", decoded["platform"])
			}
			if decoded["url"] != "https://macbook.local:4433" {
				t.Fatalf("url = %v", decoded["url"])
			}
			if decoded["currentCertHash"] != "current-hash" {
				t.Fatalf("currentCertHash = %v", decoded["currentCertHash"])
			}
		})
	}
}
