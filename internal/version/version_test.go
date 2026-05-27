package version

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestVersion_nonEmpty(t *testing.T) {
	if strings.TrimSpace(Version) == "" {
		t.Fatal("expected non-empty Version")
	}
}

func TestVersion_matchesCompanionFile(t *testing.T) {
	path := filepath.Join("..", "..", "version", "companion")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read version/companion: %v", err)
	}
	want := strings.TrimSpace(string(raw))
	if Version != want {
		t.Fatalf("Version %q != version/companion %q", Version, want)
	}
}
