import type { AgentSession, Health } from "./types";

let agentToken = "";

export async function getJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function postJSON<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function patchJSON<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getAgentToken(): Promise<string> {
  if (agentToken) return agentToken;
  const health = await getJSON<Health>("/api/health");
  if (health.status !== "ok") throw new Error(`Unexpected agent status: ${health.status}`);
  const session = await getJSON<AgentSession>("/api/session");
  if (!session.token) throw new Error("Agent did not provide a session token");
  agentToken = session.token;
  return agentToken;
}

export function ptyURL(token: string, sessionId: string, restore: boolean, cols: number, rows: number, base = window.location.href): string {
  const url = new URL("/pty", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  url.searchParams.set("session", sessionId);
  url.searchParams.set("restore", restore ? "1" : "0");
  url.searchParams.set("cols", String(cols || 100));
  url.searchParams.set("rows", String(rows || 30));
  return url.toString();
}
