package main

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	iofs "io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/creack/pty"
)

//go:embed web
var embeddedWeb embed.FS

type config struct {
	addr      string
	webDir    string
	token     string
	allowHost string
}

type server struct {
	cfg config
}

type clientMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Cols int    `json:"cols,omitempty"`
	Rows int    `json:"rows,omitempty"`
}

type serverMessage struct {
	Type    string   `json:"type"`
	Shell   string   `json:"shell,omitempty"`
	Message string   `json:"message,omitempty"`
	Errors  []string `json:"errors,omitempty"`
	Code    int      `json:"code,omitempty"`
}

func main() {
	cfg := config{}
	flag.StringVar(&cfg.addr, "addr", "127.0.0.1:8765", "HTTP listen address")
	flag.StringVar(&cfg.webDir, "web-dir", "", "directory containing built web assets; defaults to embedded assets")
	flag.StringVar(&cfg.token, "token", "", "PTY token; generated when empty")
	flag.StringVar(&cfg.allowHost, "allow-host", "", "expected host header; defaults to listen host")
	flag.Parse()

	if cfg.token == "" {
		token, err := generateToken()
		if err != nil {
			log.Fatalf("generate token: %v", err)
		}
		cfg.token = token
	}
	if cfg.allowHost == "" {
		cfg.allowHost = cfg.addr
	}

	srv := &server{cfg: cfg}
	httpServer := &http.Server{
		Addr:              cfg.addr,
		Handler:           srv.routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Crostini Ghostty Terminal listening on http://%s", cfg.addr)
	log.Printf("Session token: %s", cfg.token)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/session", s.handleSession)
	mux.HandleFunc("/pty", s.handlePTY)
	mux.Handle("/", s.staticHandler())
	return withSecurityHeaders(mux)
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"version": "0.1.0",
	})
}

func (s *server) handleSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": s.cfg.token})
}

func (s *server) handlePTY(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if !s.validToken(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{
			"http://" + s.cfg.allowHost,
			"http://localhost:*",
			"http://127.0.0.1:*",
		},
		CompressionMode: websocket.CompressionDisabled,
	})
	if err != nil {
		return
	}
	defer conn.CloseNow()

	if err := s.runPTY(r.Context(), conn); err != nil {
		log.Printf("pty session ended: %v", err)
	}
}

func (s *server) runPTY(ctx context.Context, conn *websocket.Conn) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	shell, args := chooseShell()
	cmd := exec.CommandContext(ctx, shell, args...)
	cmd.Dir = userHome()
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"COLORTERM=truecolor",
		"TERM_PROGRAM=ghostty-web",
		"TERM_PROGRAM_VERSION=0.1.0",
	)

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: 100, Rows: 30})
	if err != nil {
		sendServerMessage(ctx, conn, serverMessage{Type: "error", Message: "failed to start shell", Errors: []string{err.Error()}})
		return err
	}
	defer ptmx.Close()

	if err := sendServerMessage(ctx, conn, serverMessage{Type: "status", Shell: shell}); err != nil {
		return err
	}

	var writeMu sync.Mutex
	errCh := make(chan error, 3)

	go func() {
		buf := make([]byte, 32*1024)
		for {
			n, readErr := ptmx.Read(buf)
			if n > 0 {
				writeMu.Lock()
				writeErr := conn.Write(ctx, websocket.MessageBinary, buf[:n])
				writeMu.Unlock()
				if writeErr != nil {
					errCh <- writeErr
					return
				}
			}
			if readErr != nil {
				errCh <- readErr
				return
			}
		}
	}()

	go func() {
		for {
			msgType, payload, readErr := conn.Read(ctx)
			if readErr != nil {
				errCh <- readErr
				return
			}
			if msgType != websocket.MessageText {
				continue
			}
			if err := handleClientMessage(ptmx, payload); err != nil {
				writeMu.Lock()
				_ = sendServerMessage(ctx, conn, serverMessage{Type: "error", Message: "invalid client message", Errors: []string{err.Error()}})
				writeMu.Unlock()
			}
		}
	}()

	go func() {
		errCh <- cmd.Wait()
	}()

	err = <-errCh
	cancel()

	exitCode := 0
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		exitCode = exitErr.ExitCode()
	}
	writeMu.Lock()
	_ = sendServerMessage(context.Background(), conn, serverMessage{Type: "exit", Code: exitCode})
	writeMu.Unlock()
	return err
}

func handleClientMessage(ptmx *os.File, payload []byte) error {
	var msg clientMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		return err
	}
	switch msg.Type {
	case "input":
		if msg.Data == "" {
			return nil
		}
		_, err := io.WriteString(ptmx, msg.Data)
		return err
	case "resize":
		cols, rows, err := sanitizeSize(msg.Cols, msg.Rows)
		if err != nil {
			return err
		}
		return pty.Setsize(ptmx, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
	default:
		return fmt.Errorf("unknown message type %q", msg.Type)
	}
}

func sanitizeSize(cols, rows int) (int, int, error) {
	if cols < 2 || rows < 1 {
		return 0, 0, fmt.Errorf("invalid terminal size %dx%d", cols, rows)
	}
	if cols > 500 || rows > 200 {
		return 0, 0, fmt.Errorf("terminal size too large %dx%d", cols, rows)
	}
	return cols, rows, nil
}

func (s *server) validRequestOrigin(r *http.Request) bool {
	host := normalizeHost(r.Host)
	if host == "" || host != normalizeHost(s.cfg.allowHost) {
		return false
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme != "http" {
		return false
	}
	return normalizeHost(parsed.Host) == host
}

func (s *server) validToken(r *http.Request) bool {
	token := r.URL.Query().Get("token")
	if token == "" {
		token = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	}
	return token != "" && token == s.cfg.token
}

func (s *server) staticHandler() http.HandlerFunc {
	var fs http.FileSystem
	if s.cfg.webDir != "" {
		fs = http.Dir(s.cfg.webDir)
	} else {
		sub, err := fsSubWeb()
		if err != nil {
			panic(err)
		}
		fs = http.FS(sub)
	}
	fileServer := http.FileServer(fs)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		clean := path.Clean("/" + r.URL.Path)
		if clean == "/" || clean == "/index.html" {
			serveIndex(w, r, fs)
			return
		}
		f, err := fs.Open(strings.TrimPrefix(clean, "/"))
		if err != nil {
			serveIndex(w, r, fs)
			return
		}
		_ = f.Close()
		fileServer.ServeHTTP(w, r)
	}
}

func serveIndex(w http.ResponseWriter, r *http.Request, fs http.FileSystem) {
	f, err := fs.Open("index.html")
	if err != nil {
		http.Error(w, "index not found", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.Error(w, "index not found", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	http.ServeContent(w, r, "index.html", stat.ModTime(), f)
}

func fsSubWeb() (iofs.FS, error) {
	return iofs.Sub(embeddedWeb, "web")
}

func sendServerMessage(ctx context.Context, conn *websocket.Conn, msg serverMessage) error {
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return conn.Write(ctx, websocket.MessageText, payload)
}

func chooseShell() (string, []string) {
	candidates := []string{os.Getenv("SHELL"), "/bin/bash", "/bin/sh"}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			if strings.HasSuffix(candidate, "bash") || strings.HasSuffix(candidate, "zsh") || strings.HasSuffix(candidate, "fish") {
				return candidate, []string{"-l"}
			}
			return candidate, nil
		}
	}
	return "/bin/sh", nil
}

func userHome() string {
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return home
	}
	return "/"
}

func normalizeHost(host string) string {
	if host == "" {
		return ""
	}
	if h, p, err := net.SplitHostPort(host); err == nil {
		if h == "localhost" {
			h = "127.0.0.1"
		}
		return net.JoinHostPort(h, p)
	}
	if host == "localhost" {
		return "127.0.0.1"
	}
	return host
}

func generateToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; img-src 'self' data:; font-src 'self' data:; worker-src 'self'")
		next.ServeHTTP(w, r)
	})
}
