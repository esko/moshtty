package certs_test

import (
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/moshtty/moshtty/internal/certs"
)

func TestGenerateCertificate(t *testing.T) {
	now := time.Date(2026, 5, 25, 12, 0, 0, 0, time.UTC)
	notBefore := now.Add(-time.Minute)
	notAfter := now.Add(7 * 24 * time.Hour)

	tests := []struct {
		name      string
		notBefore time.Time
		notAfter  time.Time
		wantErr   bool
	}{
		{name: "valid", notBefore: notBefore, notAfter: notAfter},
		{name: "too long", notBefore: notBefore, notAfter: now.Add(15 * 24 * time.Hour), wantErr: true},
		{name: "invalid range", notBefore: notAfter, notAfter: notBefore, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cert, err := certs.Generate(tt.notBefore, tt.notAfter)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("generate: %v", err)
			}
			if cert.Cert.PublicKeyAlgorithm != x509.ECDSA {
				t.Fatalf("expected ECDSA cert")
			}
			if cert.Hash == "" {
				t.Fatal("expected hash")
			}
			decoded, err := base64.StdEncoding.DecodeString(cert.Hash)
			if err != nil {
				t.Fatalf("hash is not base64: %v", err)
			}
			if len(decoded) != 32 {
				t.Fatalf("hash length = %d, want 32 (sha-256)", len(decoded))
			}
			if cert.Hash != certs.HashDER(cert.DER) {
				t.Fatalf("hash mismatch")
			}
		})
	}
}

func TestSaveAndHashFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "current.pem")

	cert, err := certs.GenerateDefault(time.Now().UTC())
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if err := certs.SavePEM(path, cert); err != nil {
		t.Fatalf("save: %v", err)
	}

	hash, err := certs.HashFile(path)
	if err != nil {
		t.Fatalf("hash file: %v", err)
	}
	if hash != cert.Hash {
		t.Fatalf("hash mismatch: got %q want %q", hash, cert.Hash)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		t.Fatalf("expected certificate pem block")
	}
}

func TestLoadTLSCertificate(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "cert.pem")

	genCert, err := certs.GenerateDefault(time.Now().UTC())
	if err != nil {
		t.Fatalf("generate default: %v", err)
	}
	if err := certs.SavePEM(path, genCert); err != nil {
		t.Fatalf("save pem: %v", err)
	}

	loadedCert, err := certs.LoadTLSCertificate(path)
	if err != nil {
		t.Fatalf("load tls certificate: %v", err)
	}

	if loadedCert.Leaf == nil {
		t.Fatal("expected Leaf to be populated, but it was nil")
	}

	// Verify that the loaded leaf matches the generated cert
	if loadedCert.Leaf.SerialNumber.Cmp(genCert.Cert.SerialNumber) != 0 {
		t.Errorf("serial number mismatch: got %v, want %v", loadedCert.Leaf.SerialNumber, genCert.Cert.SerialNumber)
	}
}
