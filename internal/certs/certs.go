package certs

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"time"
)

const (
	DefaultValidity = 7 * 24 * time.Hour
	MaxValidity     = 14 * 24 * time.Hour
)

type Certificate struct {
	Cert       *x509.Certificate
	PrivateKey *ecdsa.PrivateKey
	DER        []byte
	Hash       string
	NotBefore  time.Time
	NotAfter   time.Time
}

func Generate(notBefore, notAfter time.Time) (*Certificate, error) {
	if !notAfter.After(notBefore) {
		return nil, fmt.Errorf("notAfter must be after notBefore")
	}
	if notAfter.Sub(notBefore) > MaxValidity {
		return nil, fmt.Errorf("certificate validity exceeds %s", MaxValidity)
	}

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate ecdsa key: %w", err)
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, fmt.Errorf("generate serial: %w", err)
	}

	template := x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName: "moshtty-remote",
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	der, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		return nil, fmt.Errorf("create certificate: %w", err)
	}

	cert, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, fmt.Errorf("parse certificate: %w", err)
	}

	return &Certificate{
		Cert:       cert,
		PrivateKey: key,
		DER:        der,
		Hash:       HashDER(der),
		NotBefore:  notBefore,
		NotAfter:   notAfter,
	}, nil
}

func GenerateDefault(now time.Time) (*Certificate, error) {
	notBefore := now.Add(-1 * time.Minute).UTC()
	notAfter := now.Add(DefaultValidity).UTC()
	return Generate(notBefore, notAfter)
}

// HashDER returns the WebTransport certificate pin for profile JSON export.
// It is SHA-256 over the X.509 DER bytes, encoded with standard base64 (RFC
// 4648). The Electron client must decode this to a 32-byte Uint8Array for
// WebTransport serverCertificateHashes. M4 must verify the pin against a real
// Chromium/Electron handshake before closing the milestone.
func HashDER(der []byte) string {
	sum := sha256.Sum256(der)
	return base64.StdEncoding.EncodeToString(sum[:])
}

func SavePEM(path string, cert *Certificate) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create cert dir: %w", err)
	}

	keyDER, err := x509.MarshalECPrivateKey(cert.PrivateKey)
	if err != nil {
		return fmt.Errorf("marshal private key: %w", err)
	}

	var pemBytes []byte
	pemBytes = append(pemBytes, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.DER})...)
	pemBytes = append(pemBytes, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})...)

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, pemBytes, 0o600); err != nil {
		return fmt.Errorf("write cert temp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename cert: %w", err)
	}
	return nil
}

func LoadDER(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		return nil, fmt.Errorf("no certificate block in %s", path)
	}
	return block.Bytes, nil
}

func HashFile(path string) (string, error) {
	der, err := LoadDER(path)
	if err != nil {
		return "", err
	}
	return HashDER(der), nil
}
