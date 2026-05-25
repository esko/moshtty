package config_test

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/moshtty/moshtty/internal/config"
)

func TestPathsResolution(t *testing.T) {
	home := "/Users/tester"
	paths := config.Paths{Home: home}

	tests := []struct {
		name string
		got  string
		want string
	}{
		{
			name: "user bin",
			got:  paths.UserBinDir(),
			want: filepath.Join(home, ".local/bin"),
		},
		{
			name: "launch agents dir",
			got:  paths.LaunchAgentsDir(),
			want: filepath.Join(home, "Library", "LaunchAgents"),
		},
		{
			name: "launch agent plist",
			got:  paths.LaunchAgentPath(),
			want: filepath.Join(home, "Library", "LaunchAgents", "com.moshtty.remote.plist"),
		},
	}

	if runtime.GOOS == "darwin" {
		tests = append(tests, struct {
			name string
			got  string
			want string
		}{
			name: "application support",
			got:  paths.ApplicationSupportDir(),
			want: filepath.Join(home, "Library", "Application Support", "Moshtty"),
		})
	} else {
		tests = append(tests, struct {
			name string
			got  string
			want string
		}{
			name: "application support fallback",
			got:  paths.ApplicationSupportDir(),
			want: filepath.Join(home, ".local", "share", "moshtty"),
		})
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Fatalf("got %q want %q", tt.got, tt.want)
			}
		})
	}
}
