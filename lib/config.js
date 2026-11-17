import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ~/.perhr: this computer's device key (credentials.json, readable only by you) and settings
// (config.json: the workspace to use). The plugin's older ~/.perhr/key still works until you sign in.

export const DIR = process.env.PERHR_HOME || join(homedir(), ".perhr");
const CREDS = join(DIR, "credentials.json");
const CONFIG = join(DIR, "config.json");
const OLD_KEY = join(DIR, "key");

const read = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

export function loadKey() {
  if (process.env.PERHR_KEY) return { key: process.env.PERHR_KEY.trim(), from: "PERHR_KEY" };
  const c = read(CREDS);
  if (c?.key) return { key: c.key, from: "login", email: c.email ?? null };
  if (existsSync(OLD_KEY)) {
    const k = readFileSync(OLD_KEY, "utf8").trim();
    if (k) return { key: k, from: "plugin" };
  }
  return null;
}

export function saveKey(key, email) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CREDS, JSON.stringify({ key, email, savedAt: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
  try {
    chmodSync(CREDS, 0o600);
  } catch {}
}

export function forgetKey() {
  if (existsSync(CREDS)) rmSync(CREDS);
}

export const loadConfig = () => read(CONFIG) ?? {};

export function saveConfig(patch) {
  mkdirSync(DIR, { recursive: true });
  const next = { ...loadConfig(), ...patch };
  for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
  writeFileSync(CONFIG, JSON.stringify(next, null, 2) + "\n");
  return next;
}

export const apiBase = () => (process.env.PERHR_API || loadConfig().api || "https://per.hr").replace(/\/+$/, "");
