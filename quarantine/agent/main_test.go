package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
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
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
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

func TestSessionManagerDefaultSpaceGroupsParentTabs(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID

	spaces, err := m.listSpaces(ctx)
	if err != nil {
		t.Fatalf("list spaces: %v", err)
	}
	if len(spaces) != 1 || spaces[0].ID != defaultSpaceID {
		t.Fatalf("unexpected spaces %#v", spaces)
	}
	if len(spaces[0].Tabs) != 1 || spaces[0].Tabs[0].ID != parent.ID {
		t.Fatalf("expected only parent tab in space, got %#v", spaces[0].Tabs)
	}
	if spaces[0].Tabs[0].PaneCount != 2 {
		t.Fatalf("expected pane count 2, got %d", spaces[0].Tabs[0].PaneCount)
	}
	if child, err := m.readMetadata(childID); err != nil || child.SpaceID != "" {
		t.Fatalf("expected child pane outside space listing, got child=%#v err=%v", child, err)
	}
}

func TestSessionManagerMigratesLegacyParentToDefaultSpace(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	now := time.Now().UTC()
	legacy := &terminalSession{
		ID:        "term-legacy",
		Title:     "Legacy",
		Status:    sessionStatusStale,
		CreatedAt: now,
		UpdatedAt: now,
		Socket:    m.socketPath("term-legacy"),
	}
	if err := m.writeMetadata(legacy); err != nil {
		t.Fatalf("write legacy metadata: %v", err)
	}
	if err := m.writeLayout(legacy.ID, singlePaneLayout(legacy.ID)); err != nil {
		t.Fatalf("write legacy layout: %v", err)
	}

	spaces, err := m.listSpaces(ctx)
	if err != nil {
		t.Fatalf("list spaces: %v", err)
	}
	if len(spaces) != 1 || len(spaces[0].Tabs) != 1 || spaces[0].Tabs[0].SpaceID != defaultSpaceID {
		t.Fatalf("expected migrated tab in default space, got %#v", spaces)
	}
	stored, err := m.readMetadata(legacy.ID)
	if err != nil {
		t.Fatalf("read migrated metadata: %v", err)
	}
	if stored.SpaceID != defaultSpaceID {
		t.Fatalf("expected stored default space id, got %q", stored.SpaceID)
	}
}

func TestSessionManagerCreateListRenameDeleteSpaces(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	space, err := m.createSpace("  Work  ")
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	if space.ID == "" || space.ID == defaultSpaceID || space.Title != "Work" {
		t.Fatalf("unexpected created space %#v", space)
	}

	spaces, err := m.listSpaces(ctx)
	if err != nil {
		t.Fatalf("list spaces: %v", err)
	}
	if len(spaces) != 2 {
		t.Fatalf("expected default and created spaces, got %#v", spaces)
	}

	renamed, err := m.updateSpaceTitle(ctx, space.ID, "  Ops  ")
	if err != nil {
		t.Fatalf("rename space: %v", err)
	}
	if renamed.Title != "Ops" {
		t.Fatalf("expected renamed space title, got %#v", renamed)
	}

	reset, err := m.updateSpaceTitle(ctx, space.ID, "   ")
	if err != nil {
		t.Fatalf("reset space title: %v", err)
	}
	if reset.Title != "New Space" {
		t.Fatalf("expected default non-default title, got %#v", reset)
	}

	if err := m.deleteSpace(ctx, space.ID); err != nil {
		t.Fatalf("delete empty space: %v", err)
	}
	spaces, err = m.listSpaces(ctx)
	if err != nil {
		t.Fatalf("list spaces after delete: %v", err)
	}
	if len(spaces) != 1 || spaces[0].ID != defaultSpaceID {
		t.Fatalf("expected only default space after delete, got %#v", spaces)
	}
}

func TestSessionManagerCreateSpaceDefaultTitlePersists(t *testing.T) {
	root := t.TempDir()
	m, err := newSessionManager(root)
	if err != nil {
		t.Fatalf("new session manager: %v", err)
	}

	created, err := m.createSpace("")
	if err != nil {
		t.Fatalf("create untitled space: %v", err)
	}
	if created.Title != "New Space" {
		t.Fatalf("expected deterministic default title, got %#v", created)
	}

	reopened, err := newSessionManager(root)
	if err != nil {
		t.Fatalf("reopen session manager: %v", err)
	}
	spaces, err := reopened.listSpaces(context.Background())
	if err != nil {
		t.Fatalf("list reopened spaces: %v", err)
	}
	if len(spaces) != 2 || spaces[1].ID != created.ID || spaces[1].Title != "New Space" {
		t.Fatalf("expected persisted space metadata, got %#v", spaces)
	}
}

func TestSessionManagerRejectsDefaultSpaceDeletion(t *testing.T) {
	m := newTestSessionManager(t)

	if err := m.deleteSpace(context.Background(), defaultSpaceID); err == nil {
		t.Fatal("expected default space deletion to be rejected")
	}
}

func TestSessionManagerRejectsSpaceDeleteWithTabs(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	space, err := m.createSpace("Work")
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	tab, err := m.createTab(ctx, space.ID, "")
	if err != nil {
		t.Fatalf("create tab in space: %v", err)
	}
	if tab.SpaceID != space.ID {
		t.Fatalf("expected tab in created space, got %#v", tab)
	}
	if err := m.deleteSpace(ctx, space.ID); err == nil {
		t.Fatal("expected delete with tabs to be rejected")
	}
}

func TestSessionManagerCreateTabUsesSelectedSpace(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	space, err := m.createSpace("Builds")
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	tab, err := m.createTab(ctx, space.ID, "")
	if err != nil {
		t.Fatalf("create tab in selected space: %v", err)
	}
	if tab.SpaceID != space.ID {
		t.Fatalf("expected selected space id %q, got %#v", space.ID, tab)
	}
	if _, err := m.createTab(ctx, "space-missing", ""); err == nil {
		t.Fatal("expected unknown space to be rejected")
	}

	spaces, err := m.listSpaces(ctx)
	if err != nil {
		t.Fatalf("list spaces: %v", err)
	}
	for _, listed := range spaces {
		switch listed.ID {
		case defaultSpaceID:
			if len(listed.Tabs) != 0 {
				t.Fatalf("expected no default tabs, got %#v", listed.Tabs)
			}
		case space.ID:
			if len(listed.Tabs) != 1 || listed.Tabs[0].ID != tab.ID {
				t.Fatalf("expected selected space tab, got %#v", listed.Tabs)
			}
		}
	}
}

func TestSessionManagerMovesTabBetweenSpaces(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	source, err := m.createSpace("Source")
	if err != nil {
		t.Fatalf("create source space: %v", err)
	}
	target, err := m.createSpace("Target")
	if err != nil {
		t.Fatalf("create target space: %v", err)
	}
	tab, err := m.createTab(ctx, source.ID, "")
	if err != nil {
		t.Fatalf("create tab: %v", err)
	}
	title := "Build log"
	renamed, err := m.updateTab(tab.ID, tabUpdateRequest{Title: &title})
	if err != nil {
		t.Fatalf("rename tab: %v", err)
	}
	moved, err := m.updateTab(tab.ID, tabUpdateRequest{SpaceID: target.ID})
	if err != nil {
		t.Fatalf("move tab: %v", err)
	}
	if moved.SpaceID != target.ID {
		t.Fatalf("expected moved tab in %q, got %#v", target.ID, moved)
	}
	if moved.Title != renamed.Title || !moved.CustomTitle {
		t.Fatalf("expected move to preserve custom title, got %#v", moved)
	}
	if _, err := m.updateTab(tab.ID, tabUpdateRequest{SpaceID: "space-missing"}); err == nil {
		t.Fatal("expected move to missing space to fail")
	}
	stored, err := m.readMetadata(tab.ID)
	if err != nil {
		t.Fatalf("read moved tab metadata: %v", err)
	}
	if stored.SpaceID != target.ID {
		t.Fatalf("expected failed move to leave tab in target space, got %#v", stored)
	}

	spaces, err := m.listSpaces(ctx)
	if err != nil {
		t.Fatalf("list spaces: %v", err)
	}
	for _, listed := range spaces {
		switch listed.ID {
		case source.ID:
			if len(listed.Tabs) != 0 {
				t.Fatalf("expected source space to be empty, got %#v", listed.Tabs)
			}
		case target.ID:
			if len(listed.Tabs) != 1 || listed.Tabs[0].ID != tab.ID {
				t.Fatalf("expected moved tab in target space, got %#v", listed.Tabs)
			}
		}
	}
}

func TestSessionManagerUpdateTabRenamesAndMoves(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	space, err := m.createSpace("Tasks")
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	tab, err := m.createTab(ctx, defaultSpaceID, "")
	if err != nil {
		t.Fatalf("create tab: %v", err)
	}
	title := "Worker"
	updated, err := m.updateTab(tab.ID, tabUpdateRequest{Title: &title, SpaceID: space.ID})
	if err != nil {
		t.Fatalf("rename and move tab: %v", err)
	}
	if updated.Title != title || !updated.CustomTitle || updated.SpaceID != space.ID {
		t.Fatalf("expected renamed moved tab, got %#v", updated)
	}
}

func TestSessionManagerUpdateTabRejectsChildPane(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	tab, err := m.createTab(ctx, defaultSpaceID, "")
	if err != nil {
		t.Fatalf("create tab: %v", err)
	}
	workspace, err := m.createSplit(ctx, tab.ID, tab.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := ""
	for _, child := range workspace.Children {
		if child.ID != tab.ID {
			childID = child.ID
			break
		}
	}
	if childID == "" {
		t.Fatalf("expected child pane in workspace %#v", workspace)
	}
	if _, err := m.updateTab(childID, tabUpdateRequest{SpaceID: defaultSpaceID}); err == nil {
		t.Fatal("expected child pane tab update to fail")
	}
}

func TestHandleTabPatchMovesTabToSpace(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()
	target, err := m.createSpace("Ops")
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	tab, err := m.createTab(ctx, defaultSpaceID, "")
	if err != nil {
		t.Fatalf("create tab: %v", err)
	}
	srv := &server{cfg: config{allowHost: "127.0.0.1:8765"}, sessions: m}
	req := httptest.NewRequest(http.MethodPatch, "http://127.0.0.1:8765/api/tabs/"+tab.ID, strings.NewReader(`{"spaceId":"`+target.ID+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var moved terminalSession
	if err := json.NewDecoder(rec.Body).Decode(&moved); err != nil {
		t.Fatalf("decode moved tab: %v", err)
	}
	if moved.ID != tab.ID || moved.SpaceID != target.ID {
		t.Fatalf("expected moved tab response, got %#v", moved)
	}
}

func TestHandleTabPatchRejectsMalformedJSON(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()
	tab, err := m.createTab(ctx, defaultSpaceID, "")
	if err != nil {
		t.Fatalf("create tab: %v", err)
	}
	srv := &server{cfg: config{allowHost: "127.0.0.1:8765"}, sessions: m}
	req := httptest.NewRequest(http.MethodPatch, "http://127.0.0.1:8765/api/tabs/"+tab.ID, strings.NewReader(`{"spaceId"`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSessionManagerCreateTabUsesProfileSnapshot(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()
	workdir := t.TempDir()

	profile, err := m.createProfile(profileRequest{
		Title:      "Build",
		Shell:      "/bin/sh",
		WorkingDir: workdir,
		Env:        envVars{"CROSTINI_TEST_PROFILE": "1"},
	})
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}
	tab, err := m.createTab(ctx, defaultSpaceID, profile.ID)
	if err != nil {
		t.Fatalf("create tab with profile: %v", err)
	}
	if tab.ProfileID != profile.ID || tab.Shell != "/bin/sh" || tab.WorkingDir != workdir || tab.Env["CROSTINI_TEST_PROFILE"] != "1" {
		t.Fatalf("expected profile snapshot on tab, got %#v", tab)
	}

	if _, err := m.updateProfile(profile.ID, profileRequest{Title: "Changed", Shell: "/bin/sh"}); err != nil {
		t.Fatalf("update profile: %v", err)
	}
	stored, err := m.readMetadata(tab.ID)
	if err != nil {
		t.Fatalf("read tab metadata: %v", err)
	}
	if stored.WorkingDir != workdir || stored.Env["CROSTINI_TEST_PROFILE"] != "1" {
		t.Fatalf("expected existing tab snapshot to remain stable, got %#v", stored)
	}
}

func TestSessionManagerSplitInheritsParentProfileSnapshot(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	profile, err := m.createProfile(profileRequest{Title: "Fish", Shell: "/bin/sh", Env: envVars{"PANE_PROFILE": "inherited"}})
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}
	tab, err := m.createTab(ctx, defaultSpaceID, profile.ID)
	if err != nil {
		t.Fatalf("create tab: %v", err)
	}
	workspace, err := m.createSplit(ctx, tab.ID, tab.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID
	child, err := m.readMetadata(childID)
	if err != nil {
		t.Fatalf("read child metadata: %v", err)
	}
	if child.ProfileID != profile.ID || child.Shell != "/bin/sh" || child.Env["PANE_PROFILE"] != "inherited" {
		t.Fatalf("expected inherited profile snapshot on child, got %#v", child)
	}
}

func TestSessionManagerRestartClearsCaptureAndPreservesTabLayout(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID
	if err := os.WriteFile(m.capturePath(parent.ID), []byte("old parent replay"), 0o600); err != nil {
		t.Fatalf("write parent capture: %v", err)
	}
	if err := os.WriteFile(m.capturePath(childID), []byte("old child replay"), 0o600); err != nil {
		t.Fatalf("write child capture: %v", err)
	}

	restarted, err := m.restartTab(ctx, parent.ID)
	if err != nil {
		t.Fatalf("restart tab: %v", err)
	}
	if got := layoutLeaves(&restarted.Layout); len(got) != 2 || got[0] != parent.ID || got[1] != childID {
		t.Fatalf("restart changed layout leaves %#v", got)
	}
	if _, err := os.Stat(m.capturePath(parent.ID)); !os.IsNotExist(err) {
		t.Fatalf("expected parent capture removed, err=%v", err)
	}
	if _, err := os.Stat(m.capturePath(childID)); !os.IsNotExist(err) {
		t.Fatalf("expected child capture removed, err=%v", err)
	}
}

func TestSessionManagerWorkspaceAndDetach(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "vertical", "")
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
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
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
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
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
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "vertical", "")
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

func TestSessionManagerReferencedChildPaneIsNotOrphan(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID

	orphans, err := m.listOrphanPaneSessions(ctx)
	if err != nil {
		t.Fatalf("list orphan panes: %v", err)
	}
	for _, orphan := range orphans {
		if orphan.ID == parent.ID {
			t.Fatalf("parent tab was classified as orphan: %#v", orphan)
		}
		if orphan.ID == childID {
			t.Fatalf("referenced child pane was classified as orphan: %#v", orphan)
		}
	}
}

func TestSessionManagerChildMissingFromParentLayoutIsOrphan(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID
	if err := m.writeLayout(parent.ID, singlePaneLayout(parent.ID)); err != nil {
		t.Fatalf("write parent layout without child: %v", err)
	}

	orphans, err := m.listOrphanPaneSessions(ctx)
	if err != nil {
		t.Fatalf("list orphan panes: %v", err)
	}
	if len(orphans) != 1 || orphans[0].ID != childID {
		t.Fatalf("expected missing-layout child orphan %q, got %#v", childID, orphans)
	}
}

func TestSessionManagerChildWithMissingParentMetadataIsOrphan(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "vertical", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID
	if err := os.Remove(m.metadataPath(parent.ID)); err != nil {
		t.Fatalf("remove parent metadata: %v", err)
	}

	orphans, err := m.listOrphanPaneSessions(ctx)
	if err != nil {
		t.Fatalf("list orphan panes: %v", err)
	}
	if len(orphans) != 1 || orphans[0].ID != childID {
		t.Fatalf("expected missing-parent child orphan %q, got %#v", childID, orphans)
	}
}

func TestSessionManagerDeleteOrphanPaneSessionsPreservesValidDirs(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	validParent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create valid parent session: %v", err)
	}
	validWorkspace, err := m.createSplit(ctx, validParent.ID, validParent.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create valid split: %v", err)
	}
	validChildID := validWorkspace.Layout.Second.SessionID

	orphanParent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create orphan parent session: %v", err)
	}
	orphanWorkspace, err := m.createSplit(ctx, orphanParent.ID, orphanParent.ID, "vertical", "")
	if err != nil {
		t.Fatalf("create orphan split: %v", err)
	}
	orphanChildID := orphanWorkspace.Layout.Second.SessionID
	if err := m.writeLayout(orphanParent.ID, singlePaneLayout(orphanParent.ID)); err != nil {
		t.Fatalf("write orphan parent layout without child: %v", err)
	}

	deleted, err := m.deleteOrphanPaneSessions(ctx)
	if err != nil {
		t.Fatalf("delete orphan panes: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("expected one deleted orphan, got %d", deleted)
	}
	if _, err := os.Stat(m.sessionDir(orphanChildID)); !os.IsNotExist(err) {
		t.Fatalf("expected orphan child dir removed, err=%v", err)
	}
	for _, id := range []string{validParent.ID, validChildID, orphanParent.ID} {
		if _, err := os.Stat(m.sessionDir(id)); err != nil {
			t.Fatalf("expected session dir %q preserved: %v", id, err)
		}
	}
}

func TestSessionManagerUpdateLayoutPersistsClampedRatios(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
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
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create first split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID
	workspace, err = m.createSplit(ctx, parent.ID, childID, "vertical", "")
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
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
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

func TestSessionManagerUpdateTitlePersistsCustomWorkspaceName(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	renamed, err := m.updateTitle(parent.ID, "  Work API  ")
	if err != nil {
		t.Fatalf("rename parent session: %v", err)
	}
	if renamed.Title != "Work API" || !renamed.CustomTitle {
		t.Fatalf("unexpected renamed session %#v", renamed)
	}

	sessions, err := m.list(ctx)
	if err != nil {
		t.Fatalf("list sessions: %v", err)
	}
	if len(sessions) != 1 || sessions[0].Title != "Work API" || !sessions[0].CustomTitle {
		t.Fatalf("unexpected listed session %#v", sessions)
	}
}

func TestSessionManagerUpdateTitleRenamesChildPane(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	workspace, err := m.createSplit(ctx, parent.ID, parent.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	childID := workspace.Layout.Second.SessionID
	if _, err := m.updateTitle(childID, "Logs"); err != nil {
		t.Fatalf("rename child pane: %v", err)
	}

	workspace, err = m.workspace(ctx, parent.ID)
	if err != nil {
		t.Fatalf("read workspace: %v", err)
	}
	var child *terminalSession
	for i := range workspace.Children {
		if workspace.Children[i].ID == childID {
			child = &workspace.Children[i]
		}
	}
	if child == nil || child.Title != "Logs" || !child.CustomTitle {
		t.Fatalf("expected renamed child in workspace, got %#v", workspace.Children)
	}
}

func TestSessionManagerUpdateTitleEmptyResetsToAutomaticName(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent session: %v", err)
	}
	session, err := m.readMetadata(parent.ID)
	if err != nil {
		t.Fatalf("read parent metadata: %v", err)
	}
	session.Shell = "/usr/bin/fish"
	session.Title = "Work"
	session.CustomTitle = true
	if err := m.writeMetadata(session); err != nil {
		t.Fatalf("write parent metadata: %v", err)
	}

	renamed, err := m.updateTitle(parent.ID, "   ")
	if err != nil {
		t.Fatalf("reset parent title: %v", err)
	}
	if renamed.Title != "fish" || renamed.CustomTitle {
		t.Fatalf("expected automatic fish title after reset, got %#v", renamed)
	}
}

func TestWorkerMetadataPreservesCustomTitle(t *testing.T) {
	root := t.TempDir()
	m, err := newSessionManager(root)
	if err != nil {
		t.Fatalf("new session manager: %v", err)
	}
	now := time.Now().UTC()
	if err := m.writeMetadata(&terminalSession{
		ID:          "term-custom",
		Title:       "Production",
		CustomTitle: true,
		Status:      sessionStatusStale,
		CreatedAt:   now,
		UpdatedAt:   now,
		Socket:      m.socketPath("term-custom"),
	}); err != nil {
		t.Fatalf("write metadata: %v", err)
	}

	worker := &workerSession{
		id:         "term-custom",
		root:       root,
		shell:      "/bin/bash",
		socketPath: m.socketPath("term-custom"),
	}
	worker.updateMetadata(sessionStatusRunning)

	session, err := m.readMetadata("term-custom")
	if err != nil {
		t.Fatalf("read updated metadata: %v", err)
	}
	if session.Title != "Production" || !session.CustomTitle {
		t.Fatalf("expected custom title to survive worker update, got %#v", session)
	}
}

func TestRecentWorkerLogTailsBoundedContent(t *testing.T) {
	m, err := newSessionManager(t.TempDir())
	if err != nil {
		t.Fatalf("new session manager: %v", err)
	}
	id := "term-logtail"
	if err := os.MkdirAll(m.sessionDir(id), 0o700); err != nil {
		t.Fatalf("make session dir: %v", err)
	}
	content := "old-start\n" + strings.Repeat("a", workerLogTailLimit) + "\nnew failure\n"
	if err := os.WriteFile(m.workerLogPath(id), []byte(content), 0o600); err != nil {
		t.Fatalf("write worker log: %v", err)
	}

	got := m.recentWorkerLog(id)
	if len(got) > workerLogTailLimit {
		t.Fatalf("expected bounded worker log tail, got %d bytes", len(got))
	}
	if strings.Contains(got, "old-start") {
		t.Fatalf("expected old log prefix to be trimmed, got %q", got[:32])
	}
	if !strings.Contains(got, "new failure") {
		t.Fatalf("expected recent log content, got %q", got)
	}
}

func TestEnsureRunningTimeoutIncludesWorkerLog(t *testing.T) {
	root := t.TempDir()
	m, err := newSessionManager(root)
	if err != nil {
		t.Fatalf("new session manager: %v", err)
	}
	m.workerReadyTimeout = 10 * time.Millisecond
	m.workerReadyPollInterval = time.Millisecond
	m.startWorkerFn = func(session *terminalSession) error {
		if err := os.WriteFile(m.workerLogPath(session.ID), []byte("worker bootstrap failed\npermission denied\n"), 0o600); err != nil {
			return err
		}
		return nil
	}
	m.socketReadyFn = func(context.Context, string) bool {
		return false
	}
	now := time.Now().UTC()
	if err := m.writeMetadata(&terminalSession{
		ID:        "term-timeout",
		Title:     "Terminal",
		SpaceID:   defaultSpaceID,
		Status:    sessionStatusStale,
		CreatedAt: now,
		UpdatedAt: now,
		Socket:    m.socketPath("term-timeout"),
	}); err != nil {
		t.Fatalf("write metadata: %v", err)
	}

	_, err = m.ensureRunning(context.Background(), "term-timeout")
	if err == nil {
		t.Fatal("expected ensureRunning timeout")
	}
	msg := err.Error()
	for _, want := range []string{"readiness timed out", "recent worker log", "worker bootstrap failed", "permission denied"} {
		if !strings.Contains(msg, want) {
			t.Fatalf("expected error to contain %q, got %q", want, msg)
		}
	}
}

func TestSessionEnvironmentAppliesProfileAndPreservesTerminalVars(t *testing.T) {
	env := sessionEnvironment(&terminalSession{Env: envVars{"TERM": "bad", "CUSTOM_VALUE": "ok"}})
	got := map[string]string{}
	for _, pair := range env {
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) == 2 {
			got[parts[0]] = parts[1]
		}
	}
	if got["CUSTOM_VALUE"] != "ok" {
		t.Fatalf("expected custom env value, got %#v", got)
	}
	if got["TERM"] != "xterm-256color" || got["COLORTERM"] != "truecolor" || got["TERM_PROGRAM"] != "ghostty-web" {
		t.Fatalf("expected terminal env vars to win, got %#v", got)
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

func TestSessionManagerJoinPane(t *testing.T) {
	m := newTestSessionManager(t)
	ctx := context.Background()

	parent1, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent1 session: %v", err)
	}
	parent2, err := m.create(ctx)
	if err != nil {
		t.Fatalf("create parent2 session: %v", err)
	}

	workspace1, err := m.createSplit(ctx, parent1.ID, parent1.ID, "horizontal", "")
	if err != nil {
		t.Fatalf("create split on parent1: %v", err)
	}
	childID := workspace1.Layout.Second.SessionID

	// Join childID to parent2
	workspace2, err := m.joinPaneToWorkspace(ctx, parent2.ID, childID)
	if err != nil {
		t.Fatalf("join pane to parent2: %v", err)
	}

	// Verify childID parent ID updated
	childMeta, err := m.readMetadata(childID)
	if err != nil {
		t.Fatalf("read child metadata: %v", err)
	}
	if childMeta.ParentID != parent2.ID {
		t.Fatalf("expected child parent ID to be %q, got %q", parent2.ID, childMeta.ParentID)
	}

	// Verify parent1 layout does not contain childID anymore
	layout1, err := m.readLayout(parent1.ID)
	if err != nil {
		t.Fatalf("read parent1 layout: %v", err)
	}
	if layoutContains(layout1, childID) {
		t.Fatal("expected parent1 layout not to contain childID")
	}

	// Verify parent2 layout contains childID
	if !layoutContains(&workspace2.Layout, childID) {
		t.Fatal("expected parent2 layout to contain childID")
	}
}
