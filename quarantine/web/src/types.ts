export type Health = { status: string; version: string };
export type AgentSession = { token: string };

export type TerminalSession = {
  id: string;
  title: string;
  customTitle?: boolean;
  spaceId?: string;
  profileId?: string;
  parentId?: string;
  shell?: string;
  workingDir?: string;
  env?: EnvVars;
  status: string;
  createdAt: string;
  updatedAt?: string;
  paneCount?: number;
};

export type EnvVars = Record<string, string>;

export type Profile = {
  id: string;
  title: string;
  shell?: string;
  workingDir?: string;
  env?: EnvVars;
  createdAt: string;
  updatedAt: string;
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

export type TerminalPalette = {
  name: string;
  kind: "dark" | "light";
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

export type TerminalTheme = { preset: string } | { preset: "custom"; palette: TerminalPalette };

export type TerminalSettings = {
  fontFamily: string;
  customFontName: string;
  customFontUrl: string;
  fontSize: number;
  scrollback: number;
  cursorBlink: boolean;
  accent: "green" | "blue" | "amber";
  density: "comfortable" | "compact";
  theme: TerminalTheme;
  cursorStyle: "block" | "underline" | "bar";
  terminalPadding: number;
  scrollSensitivity: number;
  defaultProfileId: string;
  keybindings: Record<string, string>;
  statusBarShowClock: boolean;
  statusBarShowPanes: boolean;
  statusBarPosition: "bottom" | "hidden";
};
