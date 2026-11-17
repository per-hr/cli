import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "claude-"));
process.env.CLAUDE_CONFIG_DIR = dir;
const { plan, apply, ALLOW, ASK } = await import("../lib/claude-settings.js");

test("adds the rules and the status line, keeping what's there", () => {
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ model: "opus", permissions: { allow: ["Bash(git status)"] } }));
  const p = plan();
  assert.equal(p.allow.length, ALLOW.length);
  assert.equal(p.ask.length, ASK.length);
  assert.equal(p.statusLine, "free");
  apply(p);
  const s = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"));
  assert.equal(s.model, "opus");
  assert.ok(s.permissions.allow.includes("Bash(git status)"));
  assert.ok(s.permissions.ask.includes("Bash(perhr time log *)"));
  assert.equal(s.statusLine.command, "perhr statusline");
  assert.ok(readFileSync(join(dir, "settings.json.perhr-backup"), "utf8").includes("opus"));
});

test("running it again adds nothing", () => {
  const p = plan();
  assert.equal(p.allow.length + p.ask.length, 0);
  assert.equal(p.statusLine, "ours");
});

test("a status line that's someone else's stays", () => {
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ statusLine: { type: "command", command: "~/bin/my-line" } }));
  const p = plan();
  assert.equal(p.statusLine, "taken");
  apply(p);
  assert.equal(JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")).statusLine.command, "~/bin/my-line");
});

test("a broken settings file is left alone", () => {
  writeFileSync(join(dir, "settings.json"), "{ not json");
  assert.throws(() => plan(), /isn't valid JSON/);
});

test("the plugin's hook and the CLI name a repo's state file the same way", async () => {
  const { stateFile } = await import("../lib/config.js");
  assert.equal(stateFile("C:\\Users\\Jordan\\Site"), stateFile("c:/users/jordan/site/"));
});
