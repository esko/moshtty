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
	defaultSpaceID       = "space-default"
	defaultSpaceTitle    = "Default Space"
	defaultProfileID     = "profile-default"
	defaultProfileTitle  = "Default Profile"
	minSplitRatio        = 0.2
	maxSplitRatio        = 0.8
	workerLogTailLimit   = 8 * 1024
)

var sessionIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,63}$`)
var envNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

type sessionManager struct {
	root                    string
	startWorkerFn           func(*terminalSession) error
	socketReadyFn           func(context.Context, string) bool
	workerReadyTimeout      time.Duration
	workerReadyPollInterval time.Duration
}

type terminalSession struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	CustomTitle bool      `json:"customTitle,omitempty"`
	SpaceID     string    `json:"spaceId,omitempty"`
	ProfileID   string    `json:"profileId,omitempty"`
	ParentID    string    `json:"parentId,omitempty"`
	Shell       string    `json:"shell,omitempty"`
	WorkingDir  string    `json:"workingDir,omitempty"`
	Env         envVars   `json:"env,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	PID         int       `json:"pid,omitempty"`
	Socket      string    `json:"socket,omitempty"`
	PaneCount   int       `json:"paneCount,omitempty"`
}

type envVars map[string]string

type profileMetadata struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Shell      string    `json:"shell,omitempty"`
	WorkingDir string    `json:"workingDir,omitempty"`
	Env        envVars   `json:"env,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type profileRequest struct {
	Title      string  `json:"title"`
	Shell      string  `json:"shell"`
	WorkingDir string  `json:"workingDir"`
	Env        envVars `json:"env"`
}

type tabRequest struct {
	ProfileID string `json:"profileId"`
}

type tabUpdateRequest struct {
	Title   *string `json:"title"`
	SpaceID string  `json:"spaceId"`
}

type spaceMetadata struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type spaceResponse struct {
	ID        string            `json:"id"`
	Title     string            `json:"title"`
	CreatedAt time.Time         `json:"createdAt"`
	UpdatedAt time.Time         `json:"updatedAt"`
	TabCount  int               `json:"tabCount"`
	Tabs      []terminalSession `json:"tabs"`
}

type workspaceResponse struct {
	Session  terminalSession   `json:"session"`
	Tab      terminalSession   `json:"tab"`
	Layout   sessionLayoutNode `json:"layout"`
	Children []terminalSession `json:"children"`
	Panes    []terminalSession `json:"panes"`
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
	ProfileID       string `json:"profileId,omitempty"`
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

type orphanCleanupResponse struct {
	Deleted int `json:"deleted"`
}

func newSessionManager(root string) (*sessionManager, error) {
	if root == "" {
		root = defaultSessionDir()
	}
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	return &sessionManager{
		root:                    root,
		workerReadyTimeout:      3 * time.Second,
		workerReadyPollInterval: 40 * time.Millisecond,
	}, nil
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
	return m.createTab(ctx, defaultSpaceID, defaultProfileID)
}

func (m *sessionManager) createTab(ctx context.Context, spaceID, profileID string) (*terminalSession, error) {
	if spaceID == "" {
		spaceID = defaultSpaceID
	}
	if _, err := m.readSpace(spaceID); err != nil {
		return nil, err
	}
	profile, err := m.readProfile(profileID)
	if err != nil {
		return nil, err
	}
	id, err := randomSessionID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	session := &terminalSession{
		ID:        id,
		Title:     "Terminal",
		SpaceID:   spaceID,
		Status:    sessionStatusStale,
		CreatedAt: now,
		UpdatedAt: now,
		Socket:    m.socketPath(id),
	}
	applyProfileToSession(session, profile)
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

func (m *sessionManager) createSpace(title string) (*spaceResponse, error) {
	spaces, err := m.readSpaces()
	if err != nil {
		return nil, err
	}
	id, err := randomSpaceID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	space := spaceMetadata{
		ID:        id,
		Title:     normalizedSpaceTitle(id, title),
		CreatedAt: now,
		UpdatedAt: now,
	}
	spaces = append(spaces, space)
	if err := m.writeSpaces(spaces); err != nil {
		return nil, err
	}
	return space.withTabs(nil), nil
}

func (m *sessionManager) listProfiles() ([]profileMetadata, error) {
	return m.readProfiles()
}

func (m *sessionManager) createProfile(req profileRequest) (*profileMetadata, error) {
	profiles, err := m.readProfiles()
	if err != nil {
		return nil, err
	}
	id, err := randomProfileID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	profile, err := normalizedProfile(id, req, now, now)
	if err != nil {
		return nil, err
	}
	profiles = append(profiles, *profile)
	if err := m.writeProfiles(profiles); err != nil {
		return nil, err
	}
	return profile, nil
}

func (m *sessionManager) updateProfile(id string, req profileRequest) (*profileMetadata, error) {
	if id == defaultProfileID {
		return nil, fmt.Errorf("cannot modify default profile")
	}
	profiles, err := m.readProfiles()
	if err != nil {
		return nil, err
	}
	for i := range profiles {
		if profiles[i].ID != id {
			continue
		}
		profile, err := normalizedProfile(id, req, profiles[i].CreatedAt, time.Now().UTC())
		if err != nil {
			return nil, err
		}
		profiles[i] = *profile
		if err := m.writeProfiles(profiles); err != nil {
			return nil, err
		}
		return profile, nil
	}
	return nil, fmt.Errorf("unknown profile id %q", id)
}

func (m *sessionManager) deleteProfile(id string) error {
	if id == defaultProfileID {
		return fmt.Errorf("cannot delete default profile")
	}
	profiles, err := m.readProfiles()
	if err != nil {
		return err
	}
	index := -1
	for i := range profiles {
		if profiles[i].ID == id {
			index = i
			break
		}
	}
	if index == -1 {
		return fmt.Errorf("unknown profile id %q", id)
	}
	profiles = append(profiles[:index], profiles[index+1:]...)
	return m.writeProfiles(profiles)
}

func (m *sessionManager) updateSpaceTitle(ctx context.Context, id, title string) (*spaceResponse, error) {
	spaces, err := m.readSpaces()
	if err != nil {
		return nil, err
	}
	for i := range spaces {
		if spaces[i].ID != id {
			continue
		}
		spaces[i].Title = normalizedSpaceTitle(id, title)
		spaces[i].UpdatedAt = time.Now().UTC()
		if err := m.writeSpaces(spaces); err != nil {
			return nil, err
		}
		return m.space(ctx, id)
	}
	return nil, fmt.Errorf("unknown space id %q", id)
}

func (m *sessionManager) deleteSpace(ctx context.Context, id string) error {
	if id == defaultSpaceID {
		return fmt.Errorf("cannot delete default space")
	}
	spaces, err := m.readSpaces()
	if err != nil {
		return err
	}
	index := -1
	for i := range spaces {
		if spaces[i].ID == id {
			index = i
			break
		}
	}
	if index == -1 {
		return fmt.Errorf("unknown space id %q", id)
	}
	tabs, err := m.list(ctx)
	if err != nil {
		return err
	}
	for _, tab := range tabs {
		if tab.SpaceID == id {
			return fmt.Errorf("space %q still has tabs", id)
		}
	}
	spaces = append(spaces[:index], spaces[index+1:]...)
	return m.writeSpaces(spaces)
}

func (m *sessionManager) listSpaces(ctx context.Context) ([]spaceResponse, error) {
	spaces, err := m.readSpaces()
	if err != nil {
		return nil, err
	}
	tabs, err := m.list(ctx)
	if err != nil {
		return nil, err
	}
	tabsBySpace := map[string][]terminalSession{}
	for _, tab := range tabs {
		tabsBySpace[tab.SpaceID] = append(tabsBySpace[tab.SpaceID], tab)
	}
	responses := make([]spaceResponse, 0, len(spaces))
	for _, space := range spaces {
		responses = append(responses, *space.withTabs(tabsBySpace[space.ID]))
	}
	return responses, nil
}

func (m *sessionManager) space(ctx context.Context, id string) (*spaceResponse, error) {
	space, err := m.readSpace(id)
	if err != nil {
		return nil, err
	}
	tabs, err := m.list(ctx)
	if err != nil {
		return nil, err
	}
	spaceTabs := make([]terminalSession, 0, len(tabs))
	for _, tab := range tabs {
		if tab.SpaceID == id {
			spaceTabs = append(spaceTabs, tab)
		}
	}
	return space.withTabs(spaceTabs), nil
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
		if err := m.ensureTabSpace(session); err != nil {
			return nil, err
		}
		m.refreshSessionStatus(ctx, session)
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
	if session.ParentID == "" {
		if err := m.ensureTabSpace(session); err != nil {
			return nil, err
		}
	}
	if m.socketReady(ctx, session.Socket) {
		return session, nil
	}
	_ = os.Remove(session.Socket)
	if err := m.startWorker(session); err != nil {
		return nil, m.workerErrorWithLog(id, fmt.Sprintf("session worker %q start command failed: %v", id, err))
	}
	deadline := time.Now().Add(m.workerReadyTimeout)
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
		case <-time.After(m.workerReadyPollInterval):
		}
	}
	return nil, m.workerErrorWithLog(id, fmt.Sprintf("session worker %q readiness timed out", id))
}

func (m *sessionManager) refreshSessionStatus(ctx context.Context, session *terminalSession) {
	if session.Status != sessionStatusRunning || m.socketReady(ctx, session.Socket) {
		return
	}
	session.Status = sessionStatusStale
	session.UpdatedAt = time.Now().UTC()
	_ = m.writeMetadata(session)
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

func (m *sessionManager) restart(ctx context.Context, id string) (*terminalSession, error) {
	session, err := m.readMetadata(id)
	if err != nil {
		return nil, err
	}
	_ = m.stop(ctx, id)
	deadline := time.Now().Add(800 * time.Millisecond)
	for time.Now().Before(deadline) {
		if !m.socketReady(ctx, session.Socket) {
			break
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(40 * time.Millisecond):
		}
	}
	_ = os.Remove(session.Socket)
	_ = os.Remove(m.capturePath(id))
	session.Status = sessionStatusStale
	session.PID = 0
	session.UpdatedAt = time.Now().UTC()
	if err := m.writeMetadata(session); err != nil {
		return nil, err
	}
	return m.ensureRunning(ctx, id)
}

func (m *sessionManager) restartTab(ctx context.Context, id string) (*workspaceResponse, error) {
	workspace, err := m.workspace(ctx, id)
	if err != nil {
		return nil, err
	}
	for _, leaf := range layoutLeaves(&workspace.Layout) {
		if _, err := m.restart(ctx, leaf); err != nil {
			return nil, err
		}
	}
	return m.workspace(ctx, id)
}

func (m *sessionManager) listOrphanPaneSessions(ctx context.Context) ([]terminalSession, error) {
	entries, err := os.ReadDir(m.root)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	orphans := []terminalSession{}
	for _, entry := range entries {
		if !entry.IsDir() || !validSessionID(entry.Name()) {
			continue
		}
		session, err := m.readMetadata(entry.Name())
		if err != nil {
			continue
		}
		orphan, err := m.isOrphanPaneSession(session)
		if err != nil {
			return nil, err
		}
		if !orphan {
			continue
		}
		m.refreshSessionStatus(ctx, session)
		orphans = append(orphans, *session)
	}
	return orphans, nil
}

func (m *sessionManager) isOrphanPaneSession(session *terminalSession) (bool, error) {
	if session.ParentID == "" {
		return false, nil
	}
	if _, err := m.readMetadata(session.ParentID); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return true, nil
		}
		return false, err
	}
	layout, err := m.readLayout(session.ParentID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return true, nil
		}
		return false, err
	}
	return !layoutContains(layout, session.ID), nil
}

func (m *sessionManager) deleteOrphanPaneSessions(ctx context.Context) (int, error) {
	orphans, err := m.listOrphanPaneSessions(ctx)
	if err != nil {
		return 0, err
	}
	deleted := 0
	for _, session := range orphans {
		current, err := m.readMetadata(session.ID)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			return deleted, err
		}
		orphan, err := m.isOrphanPaneSession(current)
		if err != nil {
			return deleted, err
		}
		if !orphan {
			continue
		}
		_ = m.stop(ctx, current.ID)
		if err := os.RemoveAll(m.sessionDir(current.ID)); err != nil {
			return deleted, err
		}
		deleted++
	}
	return deleted, nil
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
	logPath := m.workerLogPath(session.ID)
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

func (m *sessionManager) capturePath(id string) string {
	return filepath.Join(m.sessionDir(id), "capture.log")
}

func (m *sessionManager) workerLogPath(id string) string {
	return filepath.Join(m.sessionDir(id), "worker.log")
}

func (m *sessionManager) recentWorkerLog(id string) string {
	tail, err := readFileTail(m.workerLogPath(id), workerLogTailLimit)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(tail)
}

func (m *sessionManager) workerErrorWithLog(id, message string) error {
	if logTail := m.recentWorkerLog(id); logTail != "" {
		return fmt.Errorf("%s; recent worker log: %s", message, logTail)
	}
	return errors.New(message)
}

func readFileTail(path string, limit int64) (string, error) {
	if limit <= 0 {
		return "", nil
	}
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	size := info.Size()
	offset := int64(0)
	if size > limit {
		offset = size - limit
	}
	if _, err := file.Seek(offset, io.SeekStart); err != nil {
		return "", err
	}
	data, err := io.ReadAll(io.LimitReader(file, limit))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (m *sessionManager) spacesPath() string {
	return filepath.Join(m.root, "spaces.json")
}

func (m *sessionManager) profilesPath() string {
	return filepath.Join(m.root, "profiles.json")
}

func (m *sessionManager) readProfile(id string) (*profileMetadata, error) {
	if id == "" {
		id = defaultProfileID
	}
	profiles, err := m.readProfiles()
	if err != nil {
		return nil, err
	}
	for i := range profiles {
		if profiles[i].ID == id {
			return &profiles[i], nil
		}
	}
	return nil, fmt.Errorf("unknown profile id %q", id)
}

func (m *sessionManager) readProfiles() ([]profileMetadata, error) {
	f, err := os.Open(m.profilesPath())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []profileMetadata{defaultProfileMetadata(time.Now().UTC())}, nil
		}
		return nil, err
	}
	defer f.Close()

	var profiles []profileMetadata
	if err := json.NewDecoder(f).Decode(&profiles); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	hasDefault := false
	for i := range profiles {
		if profiles[i].ID == "" || !validSessionID(profiles[i].ID) {
			return nil, fmt.Errorf("invalid profile id %q", profiles[i].ID)
		}
		if profiles[i].Title == "" {
			profiles[i].Title = normalizedProfileTitle(profiles[i].ID, "")
		}
		if profiles[i].CreatedAt.IsZero() {
			profiles[i].CreatedAt = now
		}
		if profiles[i].UpdatedAt.IsZero() {
			profiles[i].UpdatedAt = profiles[i].CreatedAt
		}
		if profiles[i].Env == nil {
			profiles[i].Env = envVars{}
		}
		if profiles[i].ID == defaultProfileID {
			hasDefault = true
		}
	}
	if !hasDefault {
		profiles = append([]profileMetadata{defaultProfileMetadata(now)}, profiles...)
	}
	return profiles, nil
}

func (m *sessionManager) writeProfiles(profiles []profileMetadata) error {
	if len(profiles) == 0 {
		profiles = []profileMetadata{defaultProfileMetadata(time.Now().UTC())}
	}
	hasDefault := false
	for _, profile := range profiles {
		if !validSessionID(profile.ID) {
			return fmt.Errorf("invalid profile id %q", profile.ID)
		}
		if profile.ID == defaultProfileID {
			hasDefault = true
		}
	}
	if !hasDefault {
		return fmt.Errorf("default profile is required")
	}
	tmp := m.profilesPath() + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	encodeErr := enc.Encode(profiles)
	closeErr := f.Close()
	if encodeErr != nil {
		_ = os.Remove(tmp)
		return encodeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	return os.Rename(tmp, m.profilesPath())
}

func (m *sessionManager) readSpace(id string) (*spaceMetadata, error) {
	spaces, err := m.readSpaces()
	if err != nil {
		return nil, err
	}
	for i := range spaces {
		if spaces[i].ID == id {
			return &spaces[i], nil
		}
	}
	return nil, fmt.Errorf("unknown space id %q", id)
}

func (m *sessionManager) readSpaces() ([]spaceMetadata, error) {
	f, err := os.Open(m.spacesPath())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []spaceMetadata{defaultSpaceMetadata(time.Now().UTC())}, nil
		}
		return nil, err
	}
	defer f.Close()

	var spaces []spaceMetadata
	if err := json.NewDecoder(f).Decode(&spaces); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	hasDefault := false
	for i := range spaces {
		if spaces[i].ID == "" || !validSessionID(spaces[i].ID) {
			return nil, fmt.Errorf("invalid space id %q", spaces[i].ID)
		}
		if spaces[i].Title == "" {
			spaces[i].Title = normalizedSpaceTitle(spaces[i].ID, "")
		}
		if spaces[i].CreatedAt.IsZero() {
			spaces[i].CreatedAt = now
		}
		if spaces[i].UpdatedAt.IsZero() {
			spaces[i].UpdatedAt = spaces[i].CreatedAt
		}
		if spaces[i].ID == defaultSpaceID {
			hasDefault = true
		}
	}
	if !hasDefault {
		spaces = append([]spaceMetadata{defaultSpaceMetadata(now)}, spaces...)
	}
	return spaces, nil
}

func (m *sessionManager) writeSpaces(spaces []spaceMetadata) error {
	if len(spaces) == 0 {
		spaces = []spaceMetadata{defaultSpaceMetadata(time.Now().UTC())}
	}
	hasDefault := false
	for _, space := range spaces {
		if !validSessionID(space.ID) {
			return fmt.Errorf("invalid space id %q", space.ID)
		}
		if space.ID == defaultSpaceID {
			hasDefault = true
		}
	}
	if !hasDefault {
		return fmt.Errorf("default space is required")
	}
	tmp := m.spacesPath() + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	encodeErr := enc.Encode(spaces)
	closeErr := f.Close()
	if encodeErr != nil {
		_ = os.Remove(tmp)
		return encodeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	return os.Rename(tmp, m.spacesPath())
}

func (space spaceMetadata) withTabs(tabs []terminalSession) *spaceResponse {
	if tabs == nil {
		tabs = []terminalSession{}
	}
	return &spaceResponse{
		ID:        space.ID,
		Title:     space.Title,
		CreatedAt: space.CreatedAt,
		UpdatedAt: space.UpdatedAt,
		TabCount:  len(tabs),
		Tabs:      tabs,
	}
}

func defaultSpaceMetadata(now time.Time) spaceMetadata {
	return spaceMetadata{
		ID:        defaultSpaceID,
		Title:     defaultSpaceTitle,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func defaultProfileMetadata(now time.Time) profileMetadata {
	return profileMetadata{
		ID:        defaultProfileID,
		Title:     defaultProfileTitle,
		Env:       envVars{},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func normalizedSpaceTitle(id, title string) string {
	title = strings.TrimSpace(title)
	if title != "" {
		return title
	}
	if id == defaultSpaceID {
		return defaultSpaceTitle
	}
	return "New Space"
}

func normalizedProfile(id string, req profileRequest, createdAt, updatedAt time.Time) (*profileMetadata, error) {
	shell, err := normalizeProfilePath(req.Shell, false)
	if err != nil {
		return nil, fmt.Errorf("invalid shell: %w", err)
	}
	workingDir, err := normalizeProfilePath(req.WorkingDir, true)
	if err != nil {
		return nil, fmt.Errorf("invalid working directory: %w", err)
	}
	env, err := normalizeEnv(req.Env)
	if err != nil {
		return nil, err
	}
	return &profileMetadata{
		ID:         id,
		Title:      normalizedProfileTitle(id, req.Title),
		Shell:      shell,
		WorkingDir: workingDir,
		Env:        env,
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}, nil
}

func normalizedProfileTitle(id, title string) string {
	title = strings.TrimSpace(title)
	if title != "" {
		return title
	}
	if id == defaultProfileID {
		return defaultProfileTitle
	}
	return "New Profile"
}

func normalizeProfilePath(value string, requireDir bool) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if !filepath.IsAbs(value) {
		return "", fmt.Errorf("path must be absolute")
	}
	info, err := os.Stat(value)
	if err != nil {
		return "", err
	}
	if requireDir && !info.IsDir() {
		return "", fmt.Errorf("%q is not a directory", value)
	}
	if !requireDir && info.IsDir() {
		return "", fmt.Errorf("%q is not an executable file", value)
	}
	if !requireDir && info.Mode()&0o111 == 0 {
		return "", fmt.Errorf("%q is not executable", value)
	}
	return value, nil
}

func normalizeEnv(values envVars) (envVars, error) {
	env := envVars{}
	for key, value := range values {
		key = strings.TrimSpace(key)
		if key == "" && value == "" {
			continue
		}
		if !envNamePattern.MatchString(key) {
			return nil, fmt.Errorf("invalid environment variable name %q", key)
		}
		env[key] = value
	}
	return env, nil
}

func applyProfileToSession(session *terminalSession, profile *profileMetadata) {
	if profile == nil {
		return
	}
	session.ProfileID = profile.ID
	session.Shell = profile.Shell
	session.WorkingDir = profile.WorkingDir
	session.Env = cloneEnv(profile.Env)
	if session.Title == "" || session.Title == "Terminal" {
		session.Title = automaticSessionTitle(session.Shell)
	}
}

func cloneEnv(values envVars) envVars {
	if len(values) == 0 {
		return envVars{}
	}
	next := make(envVars, len(values))
	for key, value := range values {
		next[key] = value
	}
	return next
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

func (m *sessionManager) ensureTabSpace(session *terminalSession) error {
	if session.ParentID != "" || session.SpaceID != "" {
		return nil
	}
	session.SpaceID = defaultSpaceID
	session.UpdatedAt = time.Now().UTC()
	return m.writeMetadata(session)
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
	if err := m.ensureTabSpace(parent); err != nil {
		return nil, err
	}
	m.refreshSessionStatus(ctx, parent)
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
		m.refreshSessionStatus(ctx, session)
		children = append(children, *session)
	}
	parent.PaneCount = len(children)
	return &workspaceResponse{Session: *parent, Tab: *parent, Layout: *layout, Children: children, Panes: children}, nil
}

func (m *sessionManager) createSplit(ctx context.Context, parentID, targetID, direction, profileID string) (*workspaceResponse, error) {
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
	if profileID == "" {
		target, err := m.readMetadata(targetID)
		if err == nil {
			profileID = target.ProfileID
		}
	}
	child, err := m.createChild(ctx, parentID, profileID)
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

func (m *sessionManager) updateTab(id string, req tabUpdateRequest) (*terminalSession, error) {
	session, err := m.readMetadata(id)
	if err != nil {
		return nil, err
	}
	if session.ParentID != "" {
		return nil, fmt.Errorf("session %q is not a tab", id)
	}
	if req.Title != nil {
		nextTitle := strings.TrimSpace(*req.Title)
		if nextTitle == "" {
			session.CustomTitle = false
			session.Title = automaticSessionTitle(session.Shell)
		} else {
			session.CustomTitle = true
			session.Title = nextTitle
		}
	}
	if req.SpaceID != "" {
		if _, err := m.readSpace(req.SpaceID); err != nil {
			return nil, err
		}
		session.SpaceID = req.SpaceID
	}
	session.UpdatedAt = time.Now().UTC()
	if err := m.writeMetadata(session); err != nil {
		return nil, err
	}
	return session, nil
}

func (m *sessionManager) createChild(ctx context.Context, parentID, profileID string) (*terminalSession, error) {
	parent, err := m.readMetadata(parentID)
	if err != nil {
		return nil, err
	}
	var profile *profileMetadata
	if profileID != "" {
		profile, err = m.readProfile(profileID)
		if err != nil {
			return nil, err
		}
	}
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
	if profile != nil {
		applyProfileToSession(session, profile)
	} else {
		session.ProfileID = parent.ProfileID
		session.Shell = parent.Shell
		session.WorkingDir = parent.WorkingDir
		session.Env = cloneEnv(parent.Env)
		if session.Shell != "" {
			session.Title = automaticSessionTitle(session.Shell)
		}
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
	parent, err := m.readMetadata(parentID)
	if err != nil {
		return nil, err
	}
	session.ParentID = ""
	session.SpaceID = parent.SpaceID
	if session.SpaceID == "" {
		session.SpaceID = defaultSpaceID
	}
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

func (s *server) handleSpaces(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	switch r.Method {
	case http.MethodGet:
		spaces, err := s.sessions.listSpaces(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, spaces)
	case http.MethodPost:
		var req titleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		space, err := s.sessions.createSpace(req.Title)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, space)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) handleProfiles(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	switch r.Method {
	case http.MethodGet:
		profiles, err := s.sessions.listProfiles()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, profiles)
	case http.MethodPost:
		var req profileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		profile, err := s.sessions.createProfile(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusCreated, profile)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) handleProfile(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/profiles/"), "/")
	if id == "" || !validSessionID(id) {
		http.Error(w, "invalid profile id", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodPatch:
		var req profileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		profile, err := s.sessions.updateProfile(id, req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, profile)
	case http.MethodDelete:
		if err := s.sessions.deleteProfile(id); err != nil {
			status := http.StatusNotFound
			if id == defaultProfileID {
				status = http.StatusConflict
			}
			http.Error(w, err.Error(), status)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) handleSpace(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/spaces/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "invalid space id", http.StatusBadRequest)
		return
	}
	spaceID := parts[0]
	switch r.Method {
	case http.MethodGet:
		if len(parts) != 1 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		space, err := s.sessions.space(r.Context(), spaceID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, space)
	case http.MethodPost:
		if len(parts) != 2 || parts[1] != "tabs" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		var req tabRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		session, err := s.sessions.createTab(r.Context(), spaceID, req.ProfileID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusCreated, session)
	case http.MethodPatch:
		if len(parts) != 1 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		var req titleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		space, err := s.sessions.updateSpaceTitle(r.Context(), spaceID, req.Title)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, space)
	case http.MethodDelete:
		if len(parts) != 1 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if err := s.sessions.deleteSpace(r.Context(), spaceID); err != nil {
			status := http.StatusNotFound
			if spaceID == defaultSpaceID || strings.Contains(err.Error(), "still has tabs") {
				status = http.StatusConflict
			}
			http.Error(w, err.Error(), status)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) handleTab(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/tabs/"), "/"), "/")
	if len(parts) == 0 || !validSessionID(parts[0]) {
		http.Error(w, "invalid tab id", http.StatusBadRequest)
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
			workspace, err := s.sessions.createSplit(r.Context(), id, req.TargetSessionID, req.Direction, req.ProfileID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusCreated, workspace)
		case "restart":
			workspace, err := s.sessions.restartTab(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, workspace)
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}
	case http.MethodPatch:
		if len(parts) == 1 {
			var req tabUpdateRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			session, err := s.sessions.updateTab(id, req)
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

func (s *server) handlePane(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/panes/"), "/"), "/")
	if len(parts) == 0 || !validSessionID(parts[0]) {
		http.Error(w, "invalid pane id", http.StatusBadRequest)
		return
	}
	id := parts[0]
	switch r.Method {
	case http.MethodPatch:
		if len(parts) != 1 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
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
	case http.MethodPost:
		if len(parts) != 2 || parts[1] != "restart" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		session, err := s.sessions.restart(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, session)
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

func (s *server) handleTerminalSession(w http.ResponseWriter, r *http.Request) {
	if !s.validRequestOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/terminal-sessions/"), "/"), "/")
	if len(parts) == 1 && parts[0] == "orphans" {
		s.handleSessionOrphans(w, r)
		return
	}
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
			workspace, err := s.sessions.createSplit(r.Context(), id, req.TargetSessionID, req.Direction, req.ProfileID)
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

func (s *server) handleSessionOrphans(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		orphans, err := s.sessions.listOrphanPaneSessions(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, orphans)
	case http.MethodDelete:
		deleted, err := s.sessions.deleteOrphanPaneSessions(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, orphanCleanupResponse{Deleted: deleted})
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
		attachErr := s.sessions.workerErrorWithLog(session.ID, fmt.Sprintf("session worker %q socket attach failed: %v", session.ID, err))
		_ = sendServerMessage(ctx, ws, serverMessage{Type: "error", Message: "failed to attach session", Errors: []string{attachErr.Error()}})
		return attachErr
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

func randomSpaceID() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "space-" + hex.EncodeToString(buf), nil
}

func randomProfileID() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "profile-" + hex.EncodeToString(buf), nil
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
