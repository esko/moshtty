package remote_test

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/remote"
)

func TestRenderLaunchAgent(t *testing.T) {
	tests := []struct {
		name   string
		input  remote.LaunchAgentInput
		wantIn []string
	}{
		{
			name: "standard plist",
			input: remote.LaunchAgentInput{
				Label:      "com.moshtty.remote",
				BinaryPath: "/Users/tester/.local/bin/moshtty-remote",
				WorkingDir: "/Users/tester/Library/Application Support/Moshtty",
				StdOutPath: "/Users/tester/Library/Application Support/Moshtty/logs/moshtty-remote.out.log",
				StdErrPath: "/Users/tester/Library/Application Support/Moshtty/logs/moshtty-remote.err.log",
			},
			wantIn: []string{
				"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
				"<key>Label</key>",
				"<string>com.moshtty.remote</string>",
				"<string>/Users/tester/.local/bin/moshtty-remote</string>",
				"<string>run</string>",
				"<key>RunAtLoad</key>",
				"<true/>",
				"<key>KeepAlive</key>",
				"<true/>",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := remote.RenderLaunchAgent(tt.input)
			if err != nil {
				t.Fatalf("render: %v", err)
			}
			text := string(data)
			for _, snippet := range tt.wantIn {
				if !strings.Contains(text, snippet) {
					t.Fatalf("missing %q in plist:\n%s", snippet, text)
				}
			}
			if !bytes.HasPrefix(data, []byte("<?xml")) {
				t.Fatal("expected xml prefix")
			}
		})
	}
}

func TestPrepareRuntime(t *testing.T) {
	paths := config.Paths{Home: t.TempDir()}

	runtime, err := remote.PrepareRuntime(paths)
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	if runtime.Config.RemoteID == "" {
		t.Fatal("expected remote id")
	}
	if runtime.Token == "" {
		t.Fatal("expected token")
	}
	if runtime.Config.Cert.CurrentHash == "" {
		t.Fatal("expected current cert hash")
	}
	if runtime.Config.Cert.NextHash == "" {
		t.Fatal("expected next cert hash")
	}
}

func TestRuntimeHealth(t *testing.T) {
	paths := config.Paths{Home: t.TempDir()}
	runtime, err := remote.PrepareRuntime(paths)
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- runtime.Run(ctx)
	}()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		status, checkErr := remote.CheckHealth(context.Background(), runtime.Config.HealthEndpoint())
		if checkErr == nil {
			if status.Status != "ok" {
				t.Fatalf("status = %q", status.Status)
			}
			if status.RemoteID != runtime.Config.RemoteID {
				t.Fatalf("remote id = %q", status.RemoteID)
			}
			cancel()
			<-done
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	<-done
	t.Fatal("health endpoint did not become ready")
}
