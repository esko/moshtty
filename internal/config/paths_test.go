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
		}, struct {
			name string
			got  string
			want string
		}{
			name: "user service dir macos",
			got:  paths.UserServiceDir(),
			want: filepath.Join(home, "Library", "LaunchAgents"),
		}, struct {
			name string
			got  string
			want string
		}{
			name: "user service path macos",
			got:  paths.UserServicePath(),
			want: filepath.Join(home, "Library", "LaunchAgents", "com.moshtty.remote.plist"),
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
		}, struct {
			name string
			got  string
			want string
		}{
			name: "user service dir linux",
			got:  paths.UserServiceDir(),
			want: filepath.Join(home, ".config", "systemd", "user"),
		}, struct {
			name string
			got  string
			want string
		}{
			name: "user service path linux",
			got:  paths.UserServicePath(),
			want: filepath.Join(home, ".config", "systemd", "user", "moshtty-remote.service"),
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
