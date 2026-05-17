export type Health = { status: string; version: string };
export type AgentSession = { token: string };

export type TerminalSession = {
  id: string;
  title: string;
  customTitle?: boolean;
  parentId?: string;
  status: string;
  createdAt: string;
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
  layout: SessionLayoutNode;
  children: TerminalSession[];
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
  theme: "dark" | "highContrast" | "soft";
  scrollSensitivity: number;
};
