package certs

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
)

func LoadTLSCertificate(path string) (tls.Certificate, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return tls.Certificate{}, err
	}

	var certDER []byte
	var keyDER []byte
	for {
		block, rest := pem.Decode(data)
		if block == nil {
			break
		}
		switch block.Type {
		case "CERTIFICATE":
			certDER = append(certDER, block.Bytes...)
		case "EC PRIVATE KEY":
			keyDER = block.Bytes
		default:
			return tls.Certificate{}, fmt.Errorf("unexpected pem block %q", block.Type)
		}
		data = rest
	}
	if len(certDER) == 0 || len(keyDER) == 0 {
		return tls.Certificate{}, fmt.Errorf("missing certificate or private key in %s", path)
	}

	cert, err := tls.X509KeyPair(
		pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}),
		pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}),
	)
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("load tls certificate: %w", err)
	}

	if _, err := x509.ParseCertificate(certDER); err != nil {
		return tls.Certificate{}, fmt.Errorf("parse certificate: %w", err)
	}

	return cert, nil
}
