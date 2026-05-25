package remote

import (
	"time"

	"github.com/moshtty/moshtty/internal/certs"
)

type certSummary struct {
	Hash     string
	NotAfter time.Time
}

func generateAndSave(path string) (*certSummary, error) {
	cert, err := certs.GenerateDefault(time.Now().UTC())
	if err != nil {
		return nil, err
	}
	if err := certs.SavePEM(path, cert); err != nil {
		return nil, err
	}
	return &certSummary{
		Hash:     cert.Hash,
		NotAfter: cert.NotAfter,
	}, nil
}

func configCertHash(path string) (string, error) {
	return certs.HashFile(path)
}
