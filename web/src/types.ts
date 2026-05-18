export type Health = { status: string; version: string };
export type AgentSession = { token: string };

export type TerminalSession = {
  id: string;
  title: string;
  customTitle?: boolean;
  spaceId?: string;
  parentId?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  paneCount?: number;
};

export type SessionLayoutNode =
  | { type: "leaf"; sessionId: string }
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      ratio: number;
      first: SessionLayoutNode;
      second: SessionLayoutNode;
    };

export type Workspace = {
  session: TerminalSession;
  tab?: TerminalSession;
  layout: SessionLayoutNode;
  children: TerminalSession[];
  panes?: TerminalSession[];
};

export type Space = {
  id: string;
  title: string;
  customTitle?: boolean;
  createdAt: string;
  updatedAt: string;
  tabCount: number;
  tabs: TerminalSession[];
};

export type OrphanCleanup = {
  deleted: number;
};

export type AgentMessage = {
  type?: string;
  shell?: string;
  message?: string;
  code?: number;
};

export type TerminalSettings = {
  fontFamily: string;
  customFontName: string;
  customFontUrl: string;
  fontSize: number;
  scrollback: number;
  cursorBlink: boolean;
  accent: "green" | "blue" | "amber";
  density: "comfortable" | "compact";
  theme: "dark" | "highContrast" | "soft";
  scrollSensitivity: number;
};
