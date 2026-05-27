package remote

import (
	"testing"
	"time"

	"github.com/moshtty/moshtty/internal/certs"
	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/wtserver"
)

func TestEnsureCertificatesRotation(t *testing.T) {
	tmpDir := t.TempDir()
	paths := config.Paths{Home: tmpDir}

	// 1. Generate an expiring current cert (expires in 2 hours)
	now := time.Now().UTC()
	expiringCert, err := certs.Generate(now.Add(-1*time.Hour), now.Add(2*time.Hour))
	if err != nil {
		t.Fatalf("failed to generate expiring cert: %v", err)
	}
	if err := certs.SavePEM(paths.CurrentCertPath(), expiringCert); err != nil {
		t.Fatalf("failed to save expiring cert: %v", err)
	}

	// 2. Generate a valid next cert (expires in 7 days)
	validCert, err := certs.Generate(now.Add(-1*time.Hour), now.Add(7*24*time.Hour))
	if err != nil {
		t.Fatalf("failed to generate valid next cert: %v", err)
	}
	if err := certs.SavePEM(paths.NextCertPath(), validCert); err != nil {
		t.Fatalf("failed to save valid cert: %v", err)
	}

	cfg := config.DefaultConfig("test-remote")
	cfg.Cert.CurrentPath = paths.CurrentCertPath()
	cfg.Cert.CurrentHash = expiringCert.Hash
	cfg.Cert.NotAfter = expiringCert.NotAfter
	cfg.Cert.NextPath = paths.NextCertPath()
	cfg.Cert.NextHash = validCert.Hash
	cfg.Cert.NextNotAfter = validCert.NotAfter

	// 3. Call ensureCertificates
	if err := ensureCertificates(paths, &cfg); err != nil {
		t.Fatalf("ensureCertificates failed: %v", err)
	}

	// 4. Verify promotion
	newCurrentHash, err := certs.HashFile(paths.CurrentCertPath())
	if err != nil {
		t.Fatalf("failed to hash current cert: %v", err)
	}
	if newCurrentHash != validCert.Hash {
		t.Errorf("expected current cert to be promoted validCert (hash %s), got %s", validCert.Hash, newCurrentHash)
	}

	newNextHash, err := certs.HashFile(paths.NextCertPath())
	if err != nil {
		t.Fatalf("failed to hash next cert: %v", err)
	}
	if newNextHash == validCert.Hash || newNextHash == expiringCert.Hash {
		t.Errorf("expected a new next cert to be generated, but got hash %s", newNextHash)
	}

	// Verify config structure matches
	if cfg.Cert.CurrentHash != validCert.Hash {
		t.Errorf("expected config current hash %s, got %s", validCert.Hash, cfg.Cert.CurrentHash)
	}
	if cfg.Cert.NextHash != newNextHash {
		t.Errorf("expected config next hash %s, got %s", newNextHash, cfg.Cert.NextHash)
	}
}

func TestRuntimeCheckAndRotateCert(t *testing.T) {
	tmpDir := t.TempDir()
	paths := config.Paths{Home: tmpDir}

	// Prepare the runtime, which creates valid default certs
	r, err := PrepareRuntime(paths)
	if err != nil {
		t.Fatalf("PrepareRuntime failed: %v", err)
	}

	// Let's create the wtserver.Server manually
	tlsCert, err := certs.LoadTLSCertificate(paths.CurrentCertPath())
	if err != nil {
		t.Fatalf("load cert: %v", err)
	}

	wt, err := wtserver.New(wtserver.Options{
		Config: r.Config,
		Token:  r.Token,
		Cert:   tlsCert,
	})
	if err != nil {
		t.Fatalf("wtserver.New: %v", err)
	}
	r.wtServer = wt

	// Check initially (should not rotate because certs are valid)
	initialCert := r.wtServer.GetActiveCertificate()
	r.checkAndRotateCert()
	if r.wtServer.GetActiveCertificate() != initialCert {
		t.Fatal("expected certificate not to rotate yet")
	}

	// Now replace current cert with an expiring one and next cert with a valid one
	now := time.Now().UTC()
	expiringCert, err := certs.Generate(now.Add(-1*time.Hour), now.Add(2*time.Hour))
	if err != nil {
		t.Fatalf("generate expiring: %v", err)
	}
	if err := certs.SavePEM(paths.CurrentCertPath(), expiringCert); err != nil {
		t.Fatalf("save expiring: %v", err)
	}

	validCert, err := certs.Generate(now.Add(-1*time.Hour), now.Add(7*24*time.Hour))
	if err != nil {
		t.Fatalf("generate valid: %v", err)
	}
	if err := certs.SavePEM(paths.NextCertPath(), validCert); err != nil {
		t.Fatalf("save valid: %v", err)
	}

	// Reload the active certificate in wtServer to simulate time passing and active cert expiring.
	expiringTLS, err := certs.LoadTLSCertificate(paths.CurrentCertPath())
	if err != nil {
		t.Fatalf("load expiring tls: %v", err)
	}
	r.wtServer.UpdateCertificate(expiringTLS)

	// Trigger checkAndRotateCert
	r.checkAndRotateCert()

	// Verify that the active certificate in wtServer was updated to the promoted one (validCert)
	activeCert := r.wtServer.GetActiveCertificate()
	if activeCert.Leaf == nil {
		t.Fatal("expected active certificate to have Leaf populated")
	}
	if activeCert.Leaf.SerialNumber.Cmp(validCert.Cert.SerialNumber) != 0 {
		t.Errorf("expected active cert to be promoted validCert serial %v, got %v", validCert.Cert.SerialNumber, activeCert.Leaf.SerialNumber)
	}
}
