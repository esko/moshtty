package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

var testBinary string

func TestMain(m *testing.M) {
	tmpDir, err := os.MkdirTemp("", "moshttyctl-test")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create temp dir: %v\n", err)
		os.Exit(1)
	}

	testBinary = filepath.Join(tmpDir, "moshttyctl")
	cmd := exec.Command("go", "build", "-o", testBinary, ".")
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to build binary: %v\n", err)
		_ = os.RemoveAll(tmpDir)
		os.Exit(1)
	}

	code := m.Run()
	_ = os.RemoveAll(tmpDir)
	os.Exit(code)
}

func smokeTest(t *testing.T, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command(testBinary, args...)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func TestNoArgs_ExitsWithUsage(t *testing.T) {
	output, err := smokeTest(t)
	if err == nil {
		t.Fatal("expected command to exit with error when run with no arguments")
	}

	exitErr, ok := err.(*exec.ExitError)
	if !ok {
		t.Fatalf("expected exec.ExitError, got %v", err)
	}

	if exitErr.ExitCode() != 2 {
		t.Errorf("expected exit code 2, got %d", exitErr.ExitCode())
	}

	if !strings.Contains(output, "Usage:") {
		t.Errorf("expected usage output to contain 'Usage:', got: %s", output)
	}
}

func TestUnknownCommand_ExitsNonZero(t *testing.T) {
	output, err := smokeTest(t, "bogus-command-that-does-not-exist")
	if err == nil {
		t.Fatal("expected command to exit with error when run with unknown command")
	}

	exitErr, ok := err.(*exec.ExitError)
	if !ok {
		t.Fatalf("expected exec.ExitError, got %v", err)
	}

	if exitErr.ExitCode() != 1 {
		t.Errorf("expected exit code 1, got %d", exitErr.ExitCode())
	}

	if !strings.Contains(output, "moshtty-remote not running") {
		t.Errorf("expected output to contain 'moshtty-remote not running', got: %s", output)
	}
}
