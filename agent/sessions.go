package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/coder/websocket"
)

const (
	sessionVersion       = "1"
	sessionStatusRunning = "running"
	sessionStatusExited  = "exited"
	sessionStatusStale   = "stale"
	minSplitRatio        = 0.2
	maxSplitRatio        = 0.8
)

var sessionIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,63}$`)

type sessionManager struct {
	root          string
	startWorkerFn func(*terminalSession) error
	socketReadyFn func(context.Context, string) bool
}

type terminalSession struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	CustomTitle bool      `json:"customTitle,omitempty"`
	ParentID    string    `json:"parentId,omitempty"`
	Shell       string    `json:"shell,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	PID         int       `json:"pid,omitempty"`
	Socket      string    `json:"socket,omitempty"`
	PaneCount   int       `json:"paneCount,omitempty"`
}

type workspaceResponse struct {
	Session  terminalSession   `json:"session"`
	Layout   sessionLayoutNode `json:"layout"`
	Children []terminalSession `json:"children"`
}

type sessionLayoutNode struct {
	Type      string             `json:"type"`
	SessionID string             `json:"sessionId,omitempty"`
	Direction string             `json:"direction,omitempty"`
	Ratio     float64            `json:"ratio,omitempty"`
	First     *sessionLayoutNode `json:"first,omitempty"`
	Second    *sessionLayoutNode `json:"second,omitempty"`
}

type splitRequest struct {
	TargetSessionID string `json:"targetSessionId"`
	Direction       string `json:"direction"`
}

type detachRequest struct {
	SessionID string `json:"sessionId"`
}

type layoutRequest struct {
	Layout sessionLayoutNode `json:"layout"`
}

type titleRequest struct {
	Title string `json:"title"`
}

func newSessionManager(root string) (*sessionManager, error) {
	if root == "" {
		root = defaultSessionDir()
	}
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	return &sessionManager{root: root}, nil
}

func defaultSessionDir() string {
	if stateHome := os.Getenv("XDG_STATE_HOME"); stateHome != "" {
		return filepath.Join(stateHome, "crostini-ghostty", "sessions")
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".local", "state", "crostini-ghostty", "sessions")
	}
	return filepath.Join(os.TempDir(), "crostini-ghostty", "sessions")
}

func (m *sessionManager) create(ctx context.Context) (*terminalSession, error) {
	id, err := randomSessionID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	session := &terminalSession{
		ID:        id,
		Title:     "Terminal",
		Status:    sessionStatusStale,
		CreatedAt: now,
		UpdatedAt: now,
		Socket:    m.socketPath(id),
	}
	if err := os.MkdirAll(m.sessionDir(id), 0o700); err != nil {
		return nil, err
	}
	if err := m.writeMetadata(session); err != nil {
		return nil, err
	}
	if err := m.writeLayout(id, singlePaneLayout(id)); err != nil {
		return nil, err
	}
	return m.ensureRunning(ctx, id)
}

func (m *sessionManager) list(ctx context.Context) ([]terminalSession, error) {
	entries, err := os.ReadDir(m.root)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	sessions := make([]terminalSession, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() || !validSessionID(entry.Name()) {
			continue
		}
		session, err := m.readMetadata(entry.Name())
		if err != nil {
			continue
		}
		if session.ParentID != "" {
			continue
		}
		if !m.socketReady(ctx, session.Socket) && session.Status == sessionStatusRunning {
			session.Status = sessionStatusStale
		}
		layout, err := m.ensureLayout(session.ID)
		if err == nil {
			session.PaneCount = countLayoutLeaves(layout)
		}
		sessions = append(sessions, *session)
	}
	return sessions, nil
}

func (m *sessionManager) ensureRunning(ctx context.Context, id string) (*terminalSession, error) {
	if !validSessionID(id) {
		return nil, fmt.Errorf("invalid session id %q", id)
	}
	session, err := m.readMetadata(id)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
		now := time.Now().UTC()
		session = &terminalSession{
			ID:        id,
			Title:     "Terminal",
			Status:    sessionStatusStale,
			CreatedAt: now,
			UpdatedAt: now,
			Socket:    m.socketPath(id),
		}
		if err := os.MkdirAll(m.sessionDir(id), 0o700); err != nil {
			return nil, err
		}
		if err := m.writeMetadata(session); err != nil {
			return nil, err
		}
		if err := m.writeLayout(id, singlePaneLayout(id)); err != nil {
			return nil, err
		}
	}
	if session.Socket == "" {
		session.Socket = m.socketPath(id)
	}
	if m.socketReady(ctx, session.Socket) {
		return session, nil
	}
	_ = os.Remove(session.Socket)
	if err := m.startWorker(session); err != nil {
		return nil, err
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if m.socketReady(ctx, session.Socket) {
			session.Status = sessionStatusRunning
			session.UpdatedAt = time.Now().UTC()
			_ = m.writeMetadata(session)
			return session, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(40 * time.Millisecond):
		}
	}
	return nil, fmt.Errorf("session worker %q did not become ready", id)
}

func (m *sessionManager) stop(ctx context.Context, id string) error {
	if !validSessionID(id) {
		return fmt.Errorf("invalid session id %q", id)
	}
	session, err := m.readMetadata(id)
	if err != nil {
		return err
	}
	conn, err := net.DialTimeout("unix", session.Socket, 500*time.Millisecond)
	if err == nil {
		defer conn.Close()
		_ = writeWorkerFrame(conn, workerFrameKill, nil)
		return nil
	}
	if session.PID > 0 {
		if proc, findErr := os.FindProcess(session.PID); findErr == nil {
			_ = proc.Signal(syscall.SIGTERM)
		}
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}

func (m *sessionManager) delete(ctx context.Context, id string) error {
	session, err := m.readMetadata(id)
	if err != nil {
		return err
	}
	if session.ParentID != "" {
		if err := m.removePaneFromParent(ctx, session.ParentID, id, true, true); err != nil {
			return err
		}
		return nil
	}
	layout, err := m.ensureLayout(id)
	if err != nil {
		return err
	}
	for _, leaf := range layoutLeaves(layout) {
		_ = m.stop(ctx, leaf)
		_ = os.RemoveAll(m.sessionDir(leaf))
	}
	return nil
}

func (m *sessionManager) startSessionWorker(session *terminalSession) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	logPath := filepath.Join(m.sessionDir(session.ID), "worker.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer logFile.Close()

	cmd := exec.Command(exe, "-worker-session", session.ID, "-session-dir", m.root)
	cmd.Stdin = nil
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.Dir = userHome()
	cmd.Env = os.Environ()
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	session.PID = cmd.Process.Pid
	session.Status = sessionStatusRunning
	session.UpdatedAt = time.Now().UTC()
	if err := m.writeMetadata(session); err != nil {
		return err
	}
	return cmd.Process.Release()
}

func (m *sessionManager) startWorker(session *terminalSession) error {
	if m.startWorkerFn != nil {
		return m.startWorkerFn(session)
	}
	return m.startSessionWorker(session)
}

func (m *sessionManager) sessionSocketReady(ctx context.Context, socketPath string) bool {
	if socketPath == "" {
		return false
	}
	dialer := net.Dialer{Timeout: 150 * time.Millisecond}
	conn, err := dialer.DialContext(ctx, "unix", socketPath)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

func (m *sessionManager) socketReady(ctx context.Context, socketPath string) bool {
	if m.socketReadyFn != nil {
		return m.socketReadyFn(ctx, socketPath)
	}
	return m.sessionSocketReady(ctx, socketPath)
}

func (m *sessionManager) sessionDir(id string) string {
	return filepath.Join(m.root, id)
}

func (m *sessionManager) metadataPath(id string) string {
	return filepath.Join(m.sessionDir(id), "metadata.json")
}

func (m *sessionManager) layoutPath(id string) string {
	return filepath.Join(m.sessionDir(id), "layout.json")
}

func (m *sessionManager) socketPath(id string) string {
	return filepath.Join(m.sessionDir(id), "worker.sock")
}

func (m *sessionManager) readMetadata(id string) (*terminalSession, error) {
	if !validSessionID(id) {
		return nil, fmt.Errorf("invalid session id %q", id)
	}
	f, err := os.Open(m.metadataPath(id))
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var session terminalSession
	if err := json.NewDecoder(f).Decode(&session); err != nil {
		return nil, err
	}
	if session.ID == "" {
		session.ID = id
	}
	if session.Socket == "" {
		session.Socket = m.socketPath(id)
	}
	return &session, nil
}

func (m *sessionManager) writeMetadata(session *terminalSession) error {
	if !validSessionID(session.ID) {
		return fmt.Errorf("invalid session id %q", session.ID)
	}
	if err := os.MkdirAll(m.sessionDir(session.ID), 0o700); err != nil {
		return err
	}
	tmp := m.metadataPath(session.ID) + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	encodeErr := enc.Encode(session)
	closeErr := f.Close()
	if encodeErr != nil {
		_ = os.Remove(tmp)
		return encodeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	return os.Rename(tmp, m.metadataPath(session.ID))
}

func (m *sessionManager) readLayout(id string) (*sessionLayoutNode, error) {
	f, err := os.Open(m.layoutPath(id))
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var layout sessionLayoutNode
	if err := json.NewDecoder(f).Decode(&layout); err != nil {
		return nil, err
	}
	return &layout, nil
}

func (m *sessionManager) ensureLayout(id string) (*sessionLayoutNode, error) {
	layout, err := m.readLayout(id)
	if err == nil {
		return layout, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	layout = singlePaneLayout(id)
	return layout, m.writeLayout(id, layout)
}

func (m *sessionManager) writeLayout(parentID string, layout *sessionLayoutNode) error {
	if !validSessionID(parentID) {
		return fmt.Errorf("invalid parent session id %q", parentID)
	}
	if err := os.MkdirAll(m.sessionDir(parentID), 0o700); err != nil {
		return err
	}
	tmp := m.layoutPath(parentID) + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	encodeErr := enc.Encode(layout)
	closeErr := f.Close()
	if encodeErr != nil {
		_ = os.Remove(tmp)
		return encodeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	return os.Rename(tmp, m.layoutPath(parentID))
}

func (m *sessionManager) workspace(ctx context.Context, id string) (*workspaceResponse, error) {
	parent, err := m.readMetadata(id)
	if err != nil {
		return nil, err
	}
	if parent.ParentID != "" {
		return nil, fmt.Errorf("session %q is not a parent", id)
	}
	layout, err := m.ensureLayout(id)
	if err != nil {
		return nil, err
	}
	children := []terminalSession{}
	for _, leaf := range layoutLeaves(layout) {
		session, err := m.readMetadata(leaf)
		if err != nil {
			continue
		}
		if !m.socketReady(ctx, session.Socket) && session.Status == sessionStatusRunning {
			session.Status = sessionStatusStale
		}
		children = append(children, *session)
	}
	parent.PaneCount = len(children)
	return &workspaceResponse{Session: *parent, Layout: *layout, Children: children}, nil
}

func (m *sessionManager) createSplit(ctx context.Context, parentID, targetID, direction string) (*workspaceResponse, error) {
	if direction != "horizontal" && direction != "vertical" {
		return nil, fmt.Errorf("invalid split direction %q", direction)
	}
	parent, err := m.readMetadata(parentID)
	if err != nil {
		return nil, err
	}
	if parent.ParentID != "" {
		return nil, fmt.Errorf("session %q is not a parent", parentID)
	}
	layout, err := m.ensureLayout(parentID)
	if err != nil {
		return nil, err
	}
	if targetID == "" {
		targetID = firstLayoutLeaf(layout)
	}
	if !layoutContains(layout, targetID) {
		return nil, fmt.Errorf("target pane %q not found", targetID)
	}
	child, err := m.createChild(ctx, parentID)
	if err != nil {
		return nil, err
	}
	nextLayout, replaced := insertSplit(layout, targetID, child.ID, direction)
	if !replaced {
		return nil, fmt.Errorf("target pane %q not found", targetID)
	}
	if err := m.writeLayout(parentID, nextLayout); err != nil {
		return nil, err
	}
	return m.workspace(ctx, parentID)
}

func (m *sessionManager) updateLayout(ctx context.Context, parentID string, nextLayout *sessionLayoutNode) (*workspaceResponse, error) {
	parent, err := m.readMetadata(parentID)
	if err != nil {
		return nil, err
	}
	if parent.ParentID != "" {
		return nil, fmt.Errorf("session %q is not a parent", parentID)
	}
	current, err := m.ensureLayout(parentID)
	if err != nil {
		return nil, err
	}
	if err := validateLayoutUpdate(current, nextLayout); err != nil {
		return nil, err
	}
	normalizeLayoutRatios(nextLayout)
	if err := m.writeLayout(parentID, nextLayout); err != nil {
		return nil, err
	}
	return m.workspace(ctx, parentID)
}

func (m *sessionManager) updateTitle(id, title string) (*terminalSession, error) {
	session, err := m.readMetadata(id)
	if err != nil {
		return nil, err
	}
	nextTitle := strings.TrimSpace(title)
	if nextTitle == "" {
		session.CustomTitle = false
		session.Title = automaticSessionTitle(session.Shell)
	} else {
		session.CustomTitle = true
		session.Title = nextTitle
	}
	session.UpdatedAt = time.Now().UTC()
	if err := m.writeMetadata(session); err != nil {
		return nil, err
	}
	return session, nil
}

func (m *sessionManager) createChild(ctx context.Context, parentID string) (*terminalSession, error) {
	id, err := randomSessionID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	session := &terminalSession{
		ID:        id,
		Title:     "Terminal",
		ParentID:  parentID,
		Status:    sessionStatusStale,
		CreatedAt: now,
		UpdatedAt: now,
		Socket:    m.socketPath(id),
	}
	if err := os.MkdirAll(m.sessionDir(id), 0o700); err != nil {
		return nil, err
	}
	if err := m.writeMetadata(session); err != nil {
		return nil, err
	}
	return m.ensureRunning(ctx, id)
}

func (m *sessionManager) detachPane(ctx context.Context, parentID, sessionID string) (*terminalSession, error) {
	if parentID == sessionID {
		return nil, fmt.Errorf("cannot detach the parent pane")
	}
	if err := m.removePaneFromParent(ctx, parentID, sessionID, false, false); err != nil {
		return nil, err
	}
	session, err := m.readMetadata(sessionID)
	if err != nil {
		return nil, err
	}
	session.ParentID = ""
	session.UpdatedAt = time.Now().UTC()
	if err := m.writeMetadata(session); err != nil {
		return nil, err
	}
	if err := m.writeLayout(sessionID, singlePaneLayout(sessionID)); err != nil {
		return nil, err
	}
	return session, nil
}

func (m *sessionManager) removePaneFromParent(ctx context.Context, parentID, sessionID string, stopPane, deletePane bool) error {
	layout, err := m.ensureLayout(parentID)
	if err != nil {
		return err
	}
	next, removed := removeLeaf(layout, sessionID)
	if !removed {
		return fmt.Errorf("pane %q not found", sessionID)
	}
	if next == nil {
		next = singlePaneLayout(parentID)
	}
	if err := m.writeLayout(parentID, next); err != nil {
		return err
	}
	if stopPane {
		_ = m.stop(ctx, sessionID)
	}
	if deletePane {
		_ = os.RemoveAll(m.sessionDir(sessionID))
	}
	return nil
}

func (s *server) handleTerminalSessions(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	switch r.Method {
	case http.MethodGet:
		sessions, err := s.sessions.list(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, sessions)
	case http.MethodPost:
		session, err := s.sessions.create(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, session)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) handleTerminalSession(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/terminal-sessions/"), "/"), "/")
	if len(parts) == 0 || !validSessionID(parts[0]) {
		http.Error(w, "invalid session id", http.StatusBadRequest)
		return
	}
	id := parts[0]
	switch r.Method {
	case http.MethodGet:
		if len(parts) != 1 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		workspace, err := s.sessions.workspace(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, workspace)
	case http.MethodPost:
		if len(parts) != 2 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		switch parts[1] {
		case "splits":
			var req splitRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			workspace, err := s.sessions.createSplit(r.Context(), id, req.TargetSessionID, req.Direction)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusCreated, workspace)
		case "detach":
			var req detachRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			session, err := s.sessions.detachPane(r.Context(), id, req.SessionID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, session)
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}
	case http.MethodPatch:
		if len(parts) == 1 {
			var req titleRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			session, err := s.sessions.updateTitle(id, req.Title)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, session)
			return
		}
		if len(parts) != 2 || parts[1] != "layout" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		var req layoutRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		workspace, err := s.sessions.updateLayout(r.Context(), id, &req.Layout)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, workspace)
	case http.MethodDelete:
		if len(parts) != 1 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if err := s.sessions.delete(r.Context(), id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) runSessionPTY(ctx context.Context, ws *websocket.Conn, sessionID string, cols, rows int, restore bool) error {
	if sessionID == "" {
		session, err := s.sessions.create(ctx)
		if err != nil {
			_ = sendServerMessage(ctx, ws, serverMessage{Type: "error", Message: "failed to create session", Errors: []string{err.Error()}})
			return err
		}
		sessionID = session.ID
	}
	session, err := s.sessions.ensureRunning(ctx, sessionID)
	if err != nil {
		_ = sendServerMessage(ctx, ws, serverMessage{Type: "error", Message: "failed to start session", Errors: []string{err.Error()}})
		return err
	}
	conn, err := net.DialTimeout("unix", session.Socket, 2*time.Second)
	if err != nil {
		_ = sendServerMessage(ctx, ws, serverMessage{Type: "error", Message: "failed to attach session", Errors: []string{err.Error()}})
		return err
	}
	defer conn.Close()

	attach := workerAttachMessage{SessionID: session.ID, Cols: cols, Rows: rows, Restore: restore}
	payload, err := json.Marshal(attach)
	if err != nil {
		return err
	}
	if err := writeWorkerFrame(conn, workerFrameAttach, payload); err != nil {
		return err
	}

	errCh := make(chan error, 2)
	go func() {
		for {
			frameType, payload, readErr := readWorkerFrame(conn)
			if readErr != nil {
				errCh <- readErr
				return
			}
			switch frameType {
			case workerFrameOutput:
				if len(payload) > 0 {
					if writeErr := ws.Write(ctx, websocket.MessageBinary, payload); writeErr != nil {
						errCh <- writeErr
						return
					}
				}
			case workerFrameStatus, workerFrameError, workerFrameExit:
				if writeErr := ws.Write(ctx, websocket.MessageText, payload); writeErr != nil {
					errCh <- writeErr
					return
				}
			}
		}
	}()

	go func() {
		for {
			msgType, payload, readErr := ws.Read(ctx)
			if readErr != nil {
				errCh <- readErr
				return
			}
			if msgType != websocket.MessageText {
				continue
			}
			var msg clientMessage
			if err := json.Unmarshal(payload, &msg); err != nil {
				_ = sendServerMessage(ctx, ws, serverMessage{Type: "error", Message: "invalid client message", Errors: []string{err.Error()}})
				continue
			}
			switch msg.Type {
			case "input":
				if msg.Data == "" {
					continue
				}
				if err := writeWorkerFrame(conn, workerFrameInput, []byte(msg.Data)); err != nil {
					errCh <- err
					return
				}
			case "resize":
				cols, rows, err := sanitizeSize(msg.Cols, msg.Rows)
				if err != nil {
					_ = sendServerMessage(ctx, ws, serverMessage{Type: "error", Message: "invalid client message", Errors: []string{err.Error()}})
					continue
				}
				resizePayload, _ := json.Marshal(workerResizeMessage{Cols: cols, Rows: rows})
				if err := writeWorkerFrame(conn, workerFrameResize, resizePayload); err != nil {
					errCh <- err
					return
				}
			default:
				_ = sendServerMessage(ctx, ws, serverMessage{Type: "error", Message: "invalid client message", Errors: []string{"unknown message type"}})
			}
		}
	}()

	err = <-errCh
	if errors.Is(err, io.EOF) || websocket.CloseStatus(err) == websocket.StatusNormalClosure {
		return nil
	}
	return err
}

func sizeFromRequest(r *http.Request) (int, int, error) {
	cols := 100
	rows := 30
	if raw := r.URL.Query().Get("cols"); raw != "" {
		next, err := strconv.Atoi(raw)
		if err != nil {
			return 0, 0, err
		}
		cols = next
	}
	if raw := r.URL.Query().Get("rows"); raw != "" {
		next, err := strconv.Atoi(raw)
		if err != nil {
			return 0, 0, err
		}
		rows = next
	}
	return sanitizeSize(cols, rows)
}

func randomSessionID() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "term-" + hex.EncodeToString(buf), nil
}

func validSessionID(id string) bool {
	return sessionIDPattern.MatchString(id)
}

func singlePaneLayout(sessionID string) *sessionLayoutNode {
	return &sessionLayoutNode{Type: "leaf", SessionID: sessionID}
}

func automaticSessionTitle(shell string) string {
	if shell != "" {
		return filepath.Base(shell)
	}
	return "Terminal"
}

func countLayoutLeaves(node *sessionLayoutNode) int {
	if node == nil {
		return 0
	}
	if node.Type == "leaf" {
		return 1
	}
	return countLayoutLeaves(node.First) + countLayoutLeaves(node.Second)
}

func layoutLeaves(node *sessionLayoutNode) []string {
	if node == nil {
		return nil
	}
	if node.Type == "leaf" {
		if node.SessionID == "" {
			return nil
		}
		return []string{node.SessionID}
	}
	leaves := layoutLeaves(node.First)
	leaves = append(leaves, layoutLeaves(node.Second)...)
	return leaves
}

func firstLayoutLeaf(node *sessionLayoutNode) string {
	leaves := layoutLeaves(node)
	if len(leaves) == 0 {
		return ""
	}
	return leaves[0]
}

func layoutContains(node *sessionLayoutNode, sessionID string) bool {
	for _, leaf := range layoutLeaves(node) {
		if leaf == sessionID {
			return true
		}
	}
	return false
}

func insertSplit(node *sessionLayoutNode, targetID, childID, direction string) (*sessionLayoutNode, bool) {
	if node == nil {
		return nil, false
	}
	if node.Type == "leaf" {
		if node.SessionID != targetID {
			return node, false
		}
		return &sessionLayoutNode{
			Type:      "split",
			Direction: direction,
			Ratio:     0.5,
			First:     singlePaneLayout(targetID),
			Second:    singlePaneLayout(childID),
		}, true
	}
	first, ok := insertSplit(node.First, targetID, childID, direction)
	if ok {
		next := *node
		next.First = first
		return &next, true
	}
	second, ok := insertSplit(node.Second, targetID, childID, direction)
	if ok {
		next := *node
		next.Second = second
		return &next, true
	}
	return node, false
}

func validateLayoutUpdate(current, next *sessionLayoutNode) error {
	if current == nil || next == nil {
		return fmt.Errorf("layout is required")
	}
	if current.Type != next.Type {
		return fmt.Errorf("layout structure cannot change")
	}
	switch next.Type {
	case "leaf":
		if next.SessionID == "" || current.SessionID != next.SessionID {
			return fmt.Errorf("layout leaves cannot change")
		}
		return nil
	case "split":
		if next.Direction != "horizontal" && next.Direction != "vertical" {
			return fmt.Errorf("invalid split direction %q", next.Direction)
		}
		if current.Direction != next.Direction {
			return fmt.Errorf("layout split direction cannot change")
		}
		if err := validateLayoutUpdate(current.First, next.First); err != nil {
			return err
		}
		if err := validateLayoutUpdate(current.Second, next.Second); err != nil {
			return err
		}
		return nil
	default:
		return fmt.Errorf("invalid layout node type %q", next.Type)
	}
}

func normalizeLayoutRatios(node *sessionLayoutNode) {
	if node == nil || node.Type != "split" {
		return
	}
	if node.Ratio == 0 {
		node.Ratio = 0.5
	}
	node.Ratio = clampFloat(node.Ratio, minSplitRatio, maxSplitRatio)
	normalizeLayoutRatios(node.First)
	normalizeLayoutRatios(node.Second)
}

func clampFloat(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func removeLeaf(node *sessionLayoutNode, sessionID string) (*sessionLayoutNode, bool) {
	if node == nil {
		return nil, false
	}
	if node.Type == "leaf" {
		if node.SessionID == sessionID {
			return nil, true
		}
		return node, false
	}
	first, removedFirst := removeLeaf(node.First, sessionID)
	second, removedSecond := removeLeaf(node.Second, sessionID)
	if !removedFirst && !removedSecond {
		return node, false
	}
	if first == nil {
		return second, true
	}
	if second == nil {
		return first, true
	}
	next := *node
	next.First = first
	next.Second = second
	return &next, true
}

func writeWorkerError(w io.Writer, message string, err error) {
	payload, marshalErr := json.Marshal(serverMessage{Type: "error", Message: message, Errors: []string{err.Error()}})
	if marshalErr != nil {
		log.Printf("marshal worker error: %v", marshalErr)
		return
	}
	_ = writeWorkerFrame(w, workerFrameError, payload)
}
