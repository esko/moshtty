package remote

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/profile"
)

type HealthStatus struct {
	Status         string    `json:"status"`
	RemoteID       string    `json:"remoteId"`
	ServiceVersion string    `json:"serviceVersion"`
	StartedAt      time.Time `json:"startedAt"`
	BindEndpoint   string    `json:"bindEndpoint"`
	HealthEndpoint string    `json:"healthEndpoint"`
}

type Runtime struct {
	Paths   config.Paths
	Config  config.Config
	Token   string
	Started time.Time
	server  *http.Server
}

func PrepareRuntime(paths config.Paths) (Runtime, error) {
	dirs := []string{
		paths.ApplicationSupportDir(),
		paths.CertsDir(),
		paths.LogsDir(),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return Runtime{}, fmt.Errorf("create dir %s: %w", dir, err)
		}
	}

	cfg, token, err := ensureRuntimeAssets(paths)
	if err != nil {
		return Runtime{}, err
	}

	return Runtime{
		Paths:   paths,
		Config:  cfg,
		Token:   token,
		Started: time.Now().UTC(),
	}, nil
}

func (r *Runtime) HealthStatus() HealthStatus {
	return HealthStatus{
		Status:         "ok",
		RemoteID:       r.Config.RemoteID,
		ServiceVersion: profile.Version,
		StartedAt:      r.Started,
		BindEndpoint:   r.Config.BindEndpoint(),
		HealthEndpoint: r.Config.HealthEndpoint(),
	}
}

func (r *Runtime) Run(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(r.HealthStatus())
	})

	r.server = &http.Server{
		Addr:              r.Config.HealthEndpoint(),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- r.server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = r.server.Shutdown(shutdownCtx)
		return ctx.Err()
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}

func CheckHealth(ctx context.Context, endpoint string) (HealthStatus, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+endpoint+"/health", nil)
	if err != nil {
		return HealthStatus{}, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return HealthStatus{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return HealthStatus{}, fmt.Errorf("health check returned %s", resp.Status)
	}

	var status HealthStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return HealthStatus{}, fmt.Errorf("decode health response: %w", err)
	}
	return status, nil
}
