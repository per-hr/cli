import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../lib/ui.js";
import { normalizeRepo } from "../lib/git.js";
import { exitCodeOf, ApiError } from "../lib/api.js";

const bin = fileURLToPath(new URL("../bin/perhr.js", import.meta.url));
const home = mkdtempSync(join(tmpdir(), "perhr-"));
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { env: { ...process.env, PERHR_HOME: home, PERHR_KEY: "", PERHR_API: "http://127.0.0.1:9" }, encoding: "utf8" });

test("flags and positionals", () => {
  assert.deepEqual(parseArgs(["client", "add", "Halcyon", "--email", "ap@halcyon.coffee", "--dry-run", "--basis=agreed"]), {
    flags: { email: "ap@halcyon.coffee", "dry-run": true, basis: "agreed" },
    pos: ["client", "add", "Halcyon"],
  });
});

test("repos normalize the way per.hr stores them", () => {
  assert.equal(normalizeRepo("git@github.com:studio-lark/site.git", "/x"), "github.com/studio-lark/site");
  assert.equal(normalizeRepo("https://GitHub.com/studio-lark/site", "/x"), "github.com/studio-lark/site");
  assert.equal(normalizeRepo("", "/home/jordan/work/northline"), "northline");
});

test("exit codes", () => {
  assert.equal(exitCodeOf(new ApiError(401, "unauthorized", "x")), 3);
  assert.equal(exitCodeOf(new ApiError(409, "setup_unfinished", "x")), 4);
  assert.equal(exitCodeOf(new ApiError(404, "not_found", "x")), 5);
  assert.equal(exitCodeOf(new Error("x")), 1);
});

test("version and help", () => {
  assert.match(execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8" }), /^\d+\.\d+\.\d+/);
  assert.match(run("help").stdout, /perhr setup/);
});

test("signed out: a clear error, exit 3, and JSON with --json", () => {
  const r = run("whoami", "--json");
  assert.equal(r.status, 3);
  assert.equal(JSON.parse(r.stdout).error.fix, "perhr login");
});

test("unknown command: exit 2", () => {
  assert.equal(run("nope").status, 2);
});

test("setup with no terminal names the flags", () => {
  const r = run("setup", "--json");
  assert.equal(r.status, 1);
  assert.match(JSON.parse(r.stdout).error.message, /--step/);
});
