// A folder that holds several repos (a multi-root workspace): the repos, their branches, which repo a
// file is in, and which session a perhr command run inside one of them belongs to
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "perhr-home-"));
process.env.PERHR_HOME = home;
const { childRepos, headOf, repoOfFile } = await import("../lib/git.js");
const { sessionState, stateFile, writeJsonAtomic } = await import("../lib/config.js");

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], { cwd, stdio: "ignore" });
const ws = mkdtempSync(join(tmpdir(), "perhr-ws-"));
for (const name of ["app", "site"]) {
  mkdirSync(join(ws, name));
  git(join(ws, name), "init", "-q", "-b", "main");
  git(join(ws, name), "commit", "-q", "--allow-empty", "-m", "first");
}
git(join(ws, "app"), "remote", "add", "origin", "git@github.com:acme/app.git");
mkdirSync(join(ws, "notes"));

test("the repos in a folder, named the way per.hr stores them", () => {
  const repos = childRepos(ws).map((c) => c.repo).sort();
  assert.deepEqual(repos, ["github.com/acme/app", "site"]);
  assert.deepEqual(childRepos(join(ws, "app")), []);
});

test("a repo's branch and commit, read without running git", () => {
  const h = headOf(join(ws, "app"));
  assert.equal(h.branch, "main");
  assert.match(h.sha, /^[0-9a-f]{40}$/);
});

test("which repo a file is in", () => {
  const c = childRepos(ws);
  assert.equal(repoOfFile(c, join(ws, "app", "src", "x.ts"))?.repo, "github.com/acme/app");
  assert.equal(repoOfFile(c, "site/index.html", ws)?.repo, "site");
  assert.equal(repoOfFile(c, join(ws, "notes", "a.md")), null);
  assert.equal(repoOfFile(c, join(ws, "application", "x")), null);
});

test("inside a repo in the folder, the session that last had a prompt", () => {
  writeJsonAtomic(stateFile(ws), { session: "folder-session", children: childRepos(ws) });
  assert.equal(sessionState(join(ws, "app")).state.session, "folder-session");
  writeJsonAtomic(stateFile(join(ws, "app")), { session: "app-session" });
  const old = new Date(Date.now() - 3_600_000);
  utimesSync(stateFile(join(ws, "app")), old, old);
  assert.equal(sessionState(join(ws, "app")).state.session, "folder-session");
  utimesSync(stateFile(join(ws, "app")), new Date(Date.now() + 1000), new Date(Date.now() + 1000));
  assert.equal(sessionState(join(ws, "app")).state.session, "app-session");
  assert.equal(sessionState(ws).state.session, "folder-session");
});
