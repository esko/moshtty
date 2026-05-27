package remote

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/moshtty/moshtty/internal/certs"
	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/ctlsocket"
	"github.com/moshtty/moshtty/internal/jsonrpc"
	"github.com/moshtty/moshtty/internal/profile"
	"github.com/moshtty/moshtty/internal/wtserver"
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
	Paths        config.Paths
	Config       config.Config
	Token        string
	Started      time.Time
	SocketPath   string
	healthSrv    *http.Server
	wtServer     *wtserver.Server
	socketServer *ctlsocket.Server
	mu           sync.RWMutex
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
	r.mu.RLock()
	defer r.mu.RUnlock()
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
	r.mu.RLock()
	bindEndpoint := r.Config.BindEndpoint()
	cfg := r.Config
	r.mu.RUnlock()

	tlsCert, err := certs.LoadTLSCertificate(r.Paths.CurrentCertPath())
	if err != nil {
		return fmt.Errorf("load webtransport cert: %w", err)
	}

	wt, err := wtserver.New(wtserver.Options{
		Config: cfg,
		Token:  r.Token,
		Cert:   tlsCert,
	})
	if err != nil {
		return fmt.Errorf("create webtransport server: %w", err)
	}
	r.wtServer = wt

	// Start the certificate rotation background loop
	go r.certRotationLoop(ctx)

	errCh := make(chan error, 3)
	go func() {
		errCh <- r.runHealth()
	}()
	go func() {
		errCh <- wt.ListenAndServe(ctx, bindEndpoint)
	}()

	if r.SocketPath != "" {
		socketSrv := ctlsocket.NewServer(r.SocketPath, func(req jsonrpc.Request) (any, error) {
			return wt.Dispatch(req)
		})
		r.socketServer = socketSrv
		go func() {
			errCh <- socketSrv.Listen(ctx)
		}()
	}

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if r.healthSrv != nil {
			_ = r.healthSrv.Shutdown(shutdownCtx)
		}
		_ = wt.Close()
		if r.socketServer != nil {
			_ = r.socketServer.Close()
		}
		return ctx.Err()
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}

func (r *Runtime) runHealth() error {
	r.mu.RLock()
	healthEndpoint := r.Config.HealthEndpoint()
	r.mu.RUnlock()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(r.HealthStatus())
	})

	r.healthSrv = &http.Server{
		Addr:              healthEndpoint,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	err := r.healthSrv.ListenAndServe()
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}

func (r *Runtime) certRotationLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.checkAndRotateCert()
		}
	}
}
func (r *Runtime) checkAndRotateCert() {
	if r.wtServer == nil {
		return
	}

	activeCert := r.wtServer.GetActiveCertificate()
	needsRotation := false
	if activeCert == nil || activeCert.Leaf == nil {
		needsRotation = true
	} else if time.Now().UTC().Add(24 * time.Hour).After(activeCert.Leaf.NotAfter) {
		needsRotation = true
	}

	if !needsRotation {
		return
	}

	r.mu.Lock()
	err := ensureCertificates(r.Paths, &r.Config)
	if err != nil {
		r.mu.Unlock()
		fmt.Fprintf(os.Stderr, "cert rotation failed: %v\n", err)
		return
	}
	cfgCopy := r.Config
	r.mu.Unlock()

	newCert, err := certs.LoadTLSCertificate(r.Paths.CurrentCertPath())
	if err != nil {
		fmt.Fprintf(os.Stderr, "load rotated cert failed: %v\n", err)
		return
	}

	r.wtServer.UpdateCertificate(newCert)
	r.wtServer.UpdateConfig(cfgCopy)
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
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return HealthStatus{}, fmt.Errorf("health check returned %s", resp.Status)
	}

	var status HealthStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return HealthStatus{}, fmt.Errorf("decode health response: %w", err)
	}
	return status, nil
}
