package main

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSanitizeSize(t *testing.T) {
	cols, rows, err := sanitizeSize(120, 32)
	if err != nil {
		t.Fatalf("expected valid size: %v", err)
	}
	if cols != 120 || rows != 32 {
		t.Fatalf("unexpected size %dx%d", cols, rows)
	}

	for _, tc := range []struct {
		cols int
		rows int
	}{
		{0, 24},
		{80, 0},
		{501, 24},
		{80, 201},
	} {
		if _, _, err := sanitizeSize(tc.cols, tc.rows); err == nil {
			t.Fatalf("expected invalid size %dx%d", tc.cols, tc.rows)
		}
	}
}

func TestTokenValidation(t *testing.T) {
	srv := &server{cfg: config{token: "abc"}}
	req := httptest.NewRequest(http.MethodGet, "/pty?token=abc", nil)
	if !srv.validToken(req) {
		t.Fatal("query token should be accepted")
	}

	req = httptest.NewRequest(http.MethodGet, "/pty", nil)
	req.Header.Set("Authorization", "Bearer abc")
	if !srv.validToken(req) {
		t.Fatal("authorization token should be accepted")
	}

	req = httptest.NewRequest(http.MethodGet, "/pty?token=wrong", nil)
	if srv.validToken(req) {
		t.Fatal("wrong token should be rejected")
	}
}

func TestOriginValidation(t *testing.T) {
	srv := &server{cfg: config{allowHost: "127.0.0.1:8765"}}

	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8765/pty", nil)
	req.Host = "127.0.0.1:8765"
	req.Header.Set("Origin", "http://127.0.0.1:8765")
	if !srv.validRequestOrigin(req) {
		t.Fatal("same origin should be accepted")
	}

	req = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8765/pty", nil)
	req.Host = "evil.test"
	if srv.validRequestOrigin(req) {
		t.Fatal("unexpected host should be rejected")
	}

	req = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8765/pty", nil)
	req.Host = "127.0.0.1:8765"
	req.Header.Set("Origin", "https://evil.test")
	if srv.validRequestOrigin(req) {
		t.Fatal("unexpected origin should be rejected")
	}
}

func TestValidSessionID(t *testing.T) {
	for _, id := range []string{"term-0123abcd", "abc", "a-b-c"} {
		if !validSessionID(id) {
			t.Fatalf("expected valid session id %q", id)
		}
	}
	for _, id := range []string{"", "../bad", "Bad", "ab", "a/b", "a_b"} {
		if validSessionID(id) {
			t.Fatalf("expected invalid session id %q", id)
		}
	}
}

func TestWorkerFrameRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	payload := []byte("hello")
	if err := writeWorkerFrame(&buf, workerFrameOutput, payload); err != nil {
		t.Fatalf("write frame: %v", err)
	}
	frameType, got, err := readWorkerFrame(&buf)
	if err != nil {
		t.Fatalf("read frame: %v", err)
	}
	if frameType != workerFrameOutput {
		t.Fatalf("unexpected frame type %d", frameType)
	}
	if string(got) != string(payload) {
		t.Fatalf("unexpected payload %q", got)
	}
}

func TestLayoutSplitAndRemove(t *testing.T) {
	layout, ok := insertSplit(singlePaneLayout("term-parent"), "term-parent", "term-child", "horizontal")
	if !ok {
		t.Fatal("expected split insertion")
	}
	if got := layoutLeaves(layout); len(got) != 2 || got[0] != "term-parent" || got[1] != "term-child" {
		t.Fatalf("unexpected leaves %#v", got)
	}
	next, removed := removeLeaf(layout, "term-child")
	if !removed {
		t.Fatal("expected child removal")
	}
	if got := layoutLeaves(next); len(got) != 1 || got[0] != "term-parent" {
		t.Fatalf("unexpected leaves after removal %#v", got)
	}
}

func TestSessionManagerListsParentWorkspaces(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}

	sessions, err := m.list(ctx)
	if err != nil {
		t.Fatalf("list sessions: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected only parent session in list, got %#v", sessions)
	}
	if sessions[0].ID != parent.ID {
		t.Fatalf("unexpected parent id %q", sessions[0].ID)
	}
	if sessions[0].PaneCount != 2 {
		t.Fatalf("expected pane count 2, got %d", sessions[0].PaneCount)
	}

	if len(workspace.Children) != 2 {
		t.Fatalf("expected 2 workspace children, got %#v", workspace.Children)
	}
	if workspace.Layout.Type != "split" || workspace.Layout.Direction != "horizontal" {
		t.Fatalf("unexpected split layout %#v", workspace.Layout)
	}
	childID := workspace.Layout.Second.SessionID
	child, err := m.readMetadata(childID)
	if err != nil {
		t.Fatalf("read child metadata: %v", err)
	}
	if child.ParentID != parent.ID {
		t.Fatalf("expected child parent %q, got %q", parent.ID, child.ParentID)
	}
}

func TestSessionManagerWorkspaceAndDetach(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "vertical")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID

	workspace, err = m.workspace(ctx, parent.ID)
	if err != nil {
		t.Fatalf("read workspace: %v", err)
	}
	if workspace.Session.ID != parent.ID || workspace.Session.PaneCount != 2 {
		t.Fatalf("unexpected workspace session %#v", workspace.Session)
	}
	if got := layoutLeaves(&workspace.Layout); len(got) != 2 || got[0] != parent.ID || got[1] != childID {
		t.Fatalf("unexpected workspace leaves %#v", got)
	}

	detached, err := m.detachPane(ctx, parent.ID, childID)
	if err != nil {
		t.Fatalf("detach child pane: %v", err)
	}
	if detached.ParentID != "" {
		t.Fatalf("expected detached pane to become parent, got parent %q", detached.ParentID)
	}
	detachedLayout, err := m.readLayout(childID)
	if err != nil {
		t.Fatalf("read detached layout: %v", err)
	}
	if detachedLayout.Type != "leaf" || detachedLayout.SessionID != childID {
		t.Fatalf("unexpected detached layout %#v", detachedLayout)
	}
	parentLayout, err := m.readLayout(parent.ID)
	if err != nil {
		t.Fatalf("read parent layout: %v", err)
	}
	if got := layoutLeaves(parentLayout); len(got) != 1 || got[0] != parent.ID {
		t.Fatalf("unexpected parent leaves after detach %#v", got)
	}

	sessions, err := m.list(ctx)
	if err != nil {
		t.Fatalf("list sessions: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("expected parent and detached session in list, got %#v", sessions)
	}
}

func TestSessionManagerRemoveChildPaneUpdatesLayout(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID

	if err := m.removePaneFromParent(ctx, parent.ID, childID, true, false); err != nil {
		t.Fatalf("remove child pane: %v", err)
	}
	layout, err := m.readLayout(parent.ID)
	if err != nil {
		t.Fatalf("read parent layout: %v", err)
	}
	if got := layoutLeaves(layout); len(got) != 1 || got[0] != parent.ID {
		t.Fatalf("unexpected leaves after child removal %#v", got)
	}
}

func TestSessionManagerDeleteParentRemovesSessionTree(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID

	if err := m.delete(ctx, parent.ID); err != nil {
		t.Fatalf("delete parent session: %v", err)
	}
	if _, err := m.readMetadata(parent.ID); err == nil {
		t.Fatalf("expected parent metadata to be removed")
	}
	if _, err := m.readMetadata(childID); err == nil {
		t.Fatalf("expected child metadata to be removed")
	}
	sessions, err := m.list(ctx)
	if err != nil {
		t.Fatalf("list sessions: %v", err)
	}
	if len(sessions) != 0 {
		t.Fatalf("expected no sessions after delete, got %#v", sessions)
	}
}

func TestSessionManagerDeleteChildRemovesPaneOnly(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "vertical")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID

	if err := m.delete(ctx, childID); err != nil {
		t.Fatalf("delete child pane: %v", err)
	}
	if _, err := m.readMetadata(childID); err == nil {
		t.Fatalf("expected child metadata to be removed")
	}
	layout, err := m.readLayout(parent.ID)
	if err != nil {
		t.Fatalf("read parent layout: %v", err)
	}
	if got := layoutLeaves(layout); len(got) != 1 || got[0] != parent.ID {
		t.Fatalf("unexpected leaves after child delete %#v", got)
	}
	sessions, err := m.list(ctx)
	if err != nil {
		t.Fatalf("list sessions: %v", err)
	}
	if len(sessions) != 1 || sessions[0].ID != parent.ID || sessions[0].PaneCount != 1 {
		t.Fatalf("unexpected session list after child delete %#v", sessions)
	}
}

func TestSessionManagerUpdateLayoutPersistsClampedRatios(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	next := workspace.Layout
	next.Ratio = 0.95

	updated, err := m.updateLayout(ctx, parent.ID, &next)
	if err != nil {
		t.Fatalf("update layout: %v", err)
	}
	if updated.Layout.Ratio != maxSplitRatio {
		t.Fatalf("expected clamped ratio %v, got %v", maxSplitRatio, updated.Layout.Ratio)
	}
	stored, err := m.readLayout(parent.ID)
	if err != nil {
		t.Fatalf("read stored layout: %v", err)
	}
	if stored.Ratio != maxSplitRatio {
		t.Fatalf("expected stored clamped ratio %v, got %v", maxSplitRatio, stored.Ratio)
	}
}

func TestSessionManagerUpdateLayoutPersistsNestedRatios(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal")
	if err != nil {
		t.Fatalf("create first split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID
	workspace, err = m.createSplit(ctx, parent.ID, childID, "vertical")
	if err != nil {
		t.Fatalf("create nested split: %v", err)
	}

	next := workspace.Layout
	next.Ratio = 0.7
	next.Second.Ratio = 0.1

	updated, err := m.updateLayout(ctx, parent.ID, &next)
	if err != nil {
		t.Fatalf("update nested layout: %v", err)
	}
	if updated.Layout.Ratio != 0.7 {
		t.Fatalf("expected root ratio 0.7, got %v", updated.Layout.Ratio)
	}
	if updated.Layout.Second.Ratio != minSplitRatio {
		t.Fatalf("expected nested clamped ratio %v, got %v", minSplitRatio, updated.Layout.Second.Ratio)
	}
	stored, err := m.readLayout(parent.ID)
	if err != nil {
		t.Fatalf("read stored layout: %v", err)
	}
	if stored.Ratio != 0.7 || stored.Second.Ratio != minSplitRatio {
		t.Fatalf("unexpected stored ratios root=%v nested=%v", stored.Ratio, stored.Second.Ratio)
	}
}

func TestSessionManagerUpdateLayoutRejectsChangedLeavesAndShape(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID

	missingChild := singlePaneLayout(parent.ID)
	if _, err := m.updateLayout(ctx, parent.ID, missingChild); err == nil {
		t.Fatal("expected missing child layout to be rejected")
	}
	changedLeaf := workspace.Layout
	changedLeaf.Second.SessionID = "term-extra"
	if _, err := m.updateLayout(ctx, parent.ID, &changedLeaf); err == nil {
		t.Fatal("expected changed leaf layout to be rejected")
	}
	changedDirection := workspace.Layout
	changedDirection.Direction = "vertical"
	if _, err := m.updateLayout(ctx, parent.ID, &changedDirection); err == nil {
		t.Fatal("expected changed direction layout to be rejected")
	}
	invalidDirection := workspace.Layout
	invalidDirection.Direction = "diagonal"
	if _, err := m.updateLayout(ctx, parent.ID, &invalidDirection); err == nil {
		t.Fatal("expected invalid direction layout to be rejected")
	}
	if _, err := m.updateLayout(ctx, childID, &workspace.Layout); err == nil {
		t.Fatal("expected child workspace id to be rejected")
	}
}

func newTestSessionManager(t *testing.T) *sessionManager {
	t.Helper()
	m, err := newSessionManager(t.TempDir())
	if err != nil {
		t.Fatalf("new session manager: %v", err)
	}
	m.startWorkerFn = func(session *terminalSession) error {
		session.Status = sessionStatusRunning
		session.UpdatedAt = time.Now().UTC()
		return m.writeMetadata(session)
	}
	m.socketReadyFn = func(context.Context, string) bool {
		return true
	}
	return m
}
