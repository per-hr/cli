import { call, sessionCall, VERSION } from "./api.js";
import { forgetKey, loadConfig, loadKey, saveConfig } from "./config.js";
import { login } from "./login.js";
import { setup, setupStatus } from "./setup.js";
import { gitRemote } from "./git.js";
import { bold, choose, confirm, cyan, dim, green, hours, money, openBrowser, out, table, tty, UsageError, value, yellow } from "./ui.js";

// Each command returns data (printed as JSON with --json) and prints for people otherwise.

const today = () => new Date().toISOString().slice(0, 10);
const shortDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** A client by name (or id), case-insensitive, unique prefix allowed */
async function findClient(ref) {
  if (!ref) throw new UsageError("Name the client.");
  const list = await call("GET", "clients");
  const r = String(ref).toLowerCase();
  const exact = list.filter((c) => c.id === ref || c.name.toLowerCase() === r);
  const hits = exact.length ? exact : list.filter((c) => c.name.toLowerCase().startsWith(r));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new UsageError(`No client named ${ref}. See perhr client list.`);
  throw new UsageError(`Several clients match ${ref}: ${hits.map((c) => c.name).join(", ")}.`);
}

async function findProject(ref) {
  const list = await call("GET", "projects");
  if (!ref) {
    // In a linked folder, its project
    const here = gitRemote();
    if (here) {
      const { repos } = await call("GET", "repos");
      const linked = repos.find((x) => x.repo.toLowerCase() === here.repo.toLowerCase() && x.projectId);
      if (linked) return list.find((p) => p.id === linked.projectId) ?? { id: linked.projectId, name: linked.project };
    }
    throw new UsageError("Name the project with --project (or run this in a linked folder).");
  }
  const r = String(ref).toLowerCase();
  const hits = list.filter((p) => p.id === ref || p.name.toLowerCase() === r);
  const loose = hits.length ? hits : list.filter((p) => p.name.toLowerCase().startsWith(r));
  if (loose.length === 1) return loose[0];
  if (!loose.length) throw new UsageError(`No project named ${ref}. See perhr project list.`);
  throw new UsageError(`Several projects match ${ref}: ${loose.map((p) => p.name).join(", ")}.`);
}

export const COMMANDS = {
  async login(_p, f) {
    const user = await login({ open: !f["no-browser"], json: f.json });
    return { signedIn: true, user };
  },

  async logout(_p, f) {
    const k = loadKey();
    if (k?.from === "login") {
      // Disconnect this computer on per.hr too, so its key stops working everywhere
      const me = await call("GET", "keys").catch(() => null);
      const mine = me?.keys?.find((x) => x.thisComputer);
      if (mine) await call("DELETE", `keys/${mine.id}`).catch(() => null);
    }
    forgetKey();
    if (!f.json) out("Signed out. This computer is disconnected from per.hr.");
    return { signedOut: true };
  },

  async whoami(_p, f) {
    const me = await call("GET", "me");
    if (!f.json) {
      out(`${bold(me.user?.email)}${me.user?.name ? dim(`  ${me.user.name}`) : ""}`);
      out(`Workspace: ${me.workspace?.name ?? "?"}${dim(`  (${me.workspace?.role})`)}`);
      out(`Computer: ${me.key?.computer ?? dim(me.key?.kind === "workspace" ? "a workspace key" : "?")}`);
      out(`per.hr for AI: ${me.ai.approval}${me.ai.access === "trial" && me.ai.trialEndsAt ? `, trial until ${shortDate(me.ai.trialEndsAt)}` : ""}`);
    }
    return me;
  },

  async setup(p, f) {
    if (p[0] === "status") return setupStatus({ json: f.json });
    return setup(f);
  },

  async status(p, f) {
    // `perhr status` with the plugin's session words is the session status (perhr status inside Claude Code)
    const s = await call("GET", "status");
    if (!f.json) {
      if (s.session) out(`${green("●")} ${s.session.status === "paused" ? "Paused" : "Recording"}: ${s.session.item ?? s.session.repo}`);
      else out(dim("No session recording."));
      out(`Today: ${hours(s.today.hoursWorked)} worked, ${hours(s.today.agentHours)} agent`);
      if (s.waiting.length) {
        out(bold("\nWaiting"));
        for (const w of s.waiting) out(`  ${w.what}${dim(`, waiting on ${w.who}`)}${w.fix ? `  ${cyan(w.fix)}` : ""}`);
      }
    }
    return s;
  },

  async doctor(_p, f) {
    const local = { node: process.versions.node, cli: VERSION, key: loadKey()?.from ?? null };
    const d = await call("GET", "doctor");
    if (!f.json) {
      out(`  ${green("✓")} perhr ${VERSION}, Node ${local.node}`);
      for (const c of d.checks) out(`  ${c.ok ? green("✓") : yellow("○")} ${c.message}${c.ok || !c.fix ? "" : dim(`  → ${c.fix}`)}`);
    }
    return { ...d, local };
  },

  async keys(p, f) {
    if (p[0] === "disconnect") {
      if (!p[1]) throw new UsageError("perhr keys disconnect <id> (ids are in perhr keys)");
      if (!(await confirm(f, "Disconnect it? It stops working at once.", false))) return { cancelled: true };
      const r = await call("DELETE", `keys/${p[1]}`);
      if (r.thisComputer) forgetKey();
      if (!f.json) out(r.thisComputer ? "Disconnected this computer." : "Disconnected.");
      return r;
    }
    const { keys } = await call("GET", "keys");
    if (!f.json)
      table(
        ["ID", "Computer or Key", "Workspace", "Last Used", "Where"],
        keys.map((k) => [k.id, `${k.deviceName ?? k.name}${k.thisComputer ? " (this one)" : ""}`, k.workspace ?? "", k.lastUsedAt ? shortDate(k.lastUsedAt) : "never", k.lastPlace ?? ""]),
      );
    return { keys };
  },

  async workspace(p, f) {
    const me = await call("GET", "me");
    if (p[0] === "use") {
      const r = (p[1] ?? "").toLowerCase();
      const w = me.workspaces.find((x) => x.id === p[1] || x.name.toLowerCase() === r);
      if (!w) throw new UsageError(`Workspaces: ${me.workspaces.map((x) => x.name).join(", ")}.`);
      saveConfig({ workspace: w.personal ? null : w.id });
      if (!f.json) out(`Using ${w.name}. A linked repo still records to its own project's workspace.`);
      return { workspace: w };
    }
    if (!f.json) for (const w of me.workspaces) out(`${w.id === me.workspace?.id ? green("●") : " "} ${w.name} ${dim(w.role)}`);
    return { workspaces: me.workspaces, current: me.workspace };
  },

  async client(p, f) {
    const sub = p[0] ?? "list";
    if (sub === "list") {
      const list = (await call("GET", "clients")).filter((c) => f.all || !c.archivedAt);
      if (!f.json) table(["Client", "Email", "Status", "Projects", "Unbilled"], list.map((c) => [c.name, c.email ?? "", c.emailStatus, c.activeProjectCount, money(c.unbilledAmount)]));
      return list;
    }
    if (sub === "add") {
      const name = p[1] ?? (await value(f, "name", "Client name"));
      const email = await value(f, "email", "Their invoice email", { required: false });
      if (f["dry-run"]) return { dryRun: true, would: { name, email } };
      const c = await call("POST", "clients", { name, email, allowDuplicate: !!f["allow-duplicate"] });
      if (!f.json) out(green(`Added ${c.name}.`) + (email ? dim(` ${c.name} confirms ${email} before invoices email them: perhr client emails "${c.name}" --send`) : ""));
      return c;
    }
    const c = await findClient(p[1]);
    if (sub === "show") {
      const [full, ai] = await Promise.all([call("GET", `clients/${c.id}`), call("GET", `clients/${c.id}/ai`)]);
      if (!f.json) {
        out(bold(full.name));
        if (full.email) out(`Email: ${full.email} ${dim(c.emailStatus)}`);
        out(`AI work billed by: ${ai.basis === "delivered" ? "Agreed Hours" : "Hours Worked"}. Keep AI Private: ${ai.private ? "on" : "off"}.`);
      }
      return { ...full, ai };
    }
    if (sub === "edit") {
      const ai = {};
      if (f["show-ai"]) ai.private = false;
      if (f["hide-ai"]) ai.private = true;
      if (f.basis) ai.basis = f.basis === "agreed" ? "delivered" : f.basis === "worked" ? "time" : f.basis;
      const fields = Object.fromEntries(["email", "company", "address", "phone"].filter((k) => typeof f[k] === "string").map((k) => [k, f[k]]));
      if (typeof f.rename === "string") fields.name = f.rename;
      if (!Object.keys(ai).length && !Object.keys(fields).length) throw new UsageError("Nothing to change. Flags: --rename, --email, --address, --phone, --basis worked|agreed, --show-ai, --hide-ai.");
      if (f["dry-run"]) return { dryRun: true, client: c.name, would: { ...fields, ...ai } };
      if (Object.keys(fields).length) await call("PATCH", `clients/${c.id}`, fields);
      if (Object.keys(ai).length) await call("PATCH", `clients/${c.id}/ai`, ai);
      if (!f.json) out(green("Saved."));
      return { ok: true };
    }
    if (sub === "emails") {
      if (f.send || f.resend) {
        await call("POST", `clients/${c.id}/confirmation`, {});
        if (!f.json) out(green("Sent the confirmation email."));
        return { sent: true };
      }
      const r = await call("GET", `clients/${c.id}/emails`);
      if (!f.json) table(["Address", "Status", "Invoices"], r.addresses.map((a) => [a.email, a.blocked ? "blocked" : a.confirmed ? "confirmed" : a.confirmationSentAt ? "waiting" : "not sent", a.invoices ? "yes" : ""]));
      return r;
    }
    if (sub === "archive") {
      if (!(await confirm(f, `Archive ${c.name}?`, false))) return { cancelled: true };
      await call("PATCH", `clients/${c.id}`, { archived: true });
      if (!f.json) out("Archived.");
      return { ok: true };
    }
    throw new UsageError("perhr client list | add | show | edit | emails | archive");
  },

  async project(p, f) {
    const sub = p[0] ?? "list";
    if (sub === "list") {
      const list = (await call("GET", "projects")).filter((x) => f.all || x.status !== "archived");
      if (!f.json) table(["Project", "Client", "Status"], list.map((x) => [x.name, x.customer?.name ?? "", x.status]));
      return list;
    }
    if (sub === "add") {
      const name = p[1] ?? (await value(f, "name", "Project name"));
      const client = f.client ? await findClient(f.client) : null;
      const rate = tty() ? await value(f, "rate", "Hourly rate (Enter for your default)", { required: false }) : null;
      if (f.rate && !tty()) throw new UsageError("Rates are typed at the keyboard. Run perhr project add yourself in a terminal to set one.");
      if (f["dry-run"]) return { dryRun: true, would: { name, client: client?.name ?? null } };
      const x = await call("POST", "projects", { name, ...(client ? { customerId: client.id } : {}), ...(rate ? { hourlyRate: Number(rate) } : {}) }, { interactive: !!rate });
      if (!f.json) out(green(`Added ${x.name}.`));
      return x;
    }
    throw new UsageError("perhr project list | add");
  },

  async repo(p, f) {
    const sub = p[0] ?? "list";
    if (sub === "list") {
      const { repos } = await call("GET", "repos");
      if (!f.json) table(["Repo", "Project", "Client", "Last Seen"], repos.map((r) => [r.repo, r.ignored ? "(not recorded)" : (r.project ?? "(not linked)"), r.client ?? "", shortDate(r.lastSeenAt)]));
      return { repos };
    }
    if (sub === "link") {
      const here = gitRemote();
      const repo = f.repo ?? here?.repo;
      if (!repo) throw new UsageError("Run this in a git folder, or pass --repo owner/name.");
      const project = await findProject(f.project ?? p[1]);
      if (f["dry-run"]) return { dryRun: true, would: { repo, project: project.name } };
      const { repos } = await call("GET", "repos");
      const had = repos.find((r) => r.repo.toLowerCase() === repo.toLowerCase());
      if (had) await call("PATCH", `repos/${had.id}`, { projectId: project.id });
      else await call("POST", "repos", { repo, projectId: project.id });
      if (!f.json) out(green(`${repo} records to ${project.name}.`));
      return { repo, project: project.name };
    }
    throw new UsageError("perhr repo list | link");
  },

  async time(p, f) {
    const sub = p[0] ?? "list";
    if (sub === "list") {
      const q = new URLSearchParams({ ...(f.from ? { startDate: f.from } : {}), ...(f.to ? { endDate: f.to } : {}), ...(f.unbilled ? { isBilled: "false" } : {}) });
      const list = await call("GET", `time?${q}`);
      if (!f.json) table(["Date", "Project", "Hours", "Title"], list.slice(0, Number(f.limit ?? 25)).map((e) => [shortDate(e.date), e.project?.name ?? "", hours(e.hours), e.title ?? ""]));
      return list;
    }
    if (sub === "log") {
      const h = Number(p[1] ?? (await value(f, "hours", "Hours")));
      if (!(h > 0)) throw new UsageError("perhr time log <hours> --project <name> [--title …] [--date YYYY-MM-DD]");
      const project = await findProject(f.project);
      const body = { projectId: project.id, date: f.date ?? today(), hours: h, ...(f.title ? { title: f.title } : {}), ...(f.note ? { description: f.note } : {}) };
      if (f["dry-run"]) return { dryRun: true, would: { ...body, project: project.name } };
      const e = await call("POST", "time", body);
      if (!f.json) out(green(`Logged ${hours(h)} on ${project.name}.`));
      return e;
    }
    throw new UsageError("perhr time list | log");
  },

  async plan(p, f) {
    const sub = p[0] ?? "list";
    if (sub === "list") {
      const project = f.project ? await findProject(f.project) : null;
      const list = await call("GET", `plan${project ? `?projectId=${project.id}` : ""}`);
      const items = Array.isArray(list) ? list : (list.items ?? []);
      if (!f.json) table(["Ref", "Title", "Status", "Estimate"], items.filter((i) => f.all || i.status !== "done").map((i) => [i.ref ?? "", i.title, i.status, i.estimatedHours ? hours(i.estimatedHours) : ""]));
      return items;
    }
    if (sub === "add") {
      const title = p.slice(1).join(" ") || (await value(f, "title", "Title"));
      const project = await findProject(f.project);
      const body = { projectId: project.id, title, ...(f.ref ? { ref: f.ref } : {}), ...(f.estimate ? { estimatedHours: Number(f.estimate) } : {}) };
      if (f["dry-run"]) return { dryRun: true, would: { ...body, project: project.name } };
      const i = await call("POST", "plan", body);
      if (!f.json) out(green(`Added to ${project.name}'s Plan.`));
      return i;
    }
    throw new UsageError("perhr plan list | add");
  },

  async review(p, f) {
    const sub = p[0] ?? "list";
    if (sub === "list") {
      const r = await call("GET", "review");
      if (!f.json) {
        if (!r.sessions.length) out(dim("Nothing in To Review."));
        table(["ID", "When", "Project", "Hours Worked", "Agent", "What"], r.sessions.map((s) => [s.id, shortDate(s.startedAt), s.project?.name ?? "(no project)", hours(s.humanHours), hours(s.agentHours), (s.item ? `${s.item.ref ? `${s.item.ref}: ` : ""}${s.item.title}` : (s.summary ?? "").split("\n")[0]).slice(0, 60)]));
      }
      return r;
    }
    const id = p[1];
    if (!id) throw new UsageError(`perhr review ${sub} <id> (ids are in perhr review)`);
    const path = { confirm: "confirm", dismiss: "dismiss", undo: "undo" }[sub];
    if (!path) throw new UsageError("perhr review | review confirm <id> | dismiss <id> | undo <id>");
    if (f["dry-run"]) return { dryRun: true, would: `${sub} ${id}` };
    const r = await call("POST", `review/${id}/${path}`, {});
    if (!f.json) out(green({ confirm: "Confirmed.", dismiss: "Dismissed.", undo: "Back in To Review." }[sub]));
    return r;
  },

  async invoice(p, f) {
    const sub = p[0] ?? "list";
    if (sub === "list") {
      const list = await call("GET", "invoices");
      const shown = list.filter((i) => !f.status || i.status === f.status);
      if (!f.json) table(["Invoice", "Client", "Status", "Issued", "Total"], shown.slice(0, Number(f.limit ?? 25)).map((i) => [i.invoiceNumber, i.customer?.name ?? "", i.status, shortDate(i.issueDate), money(i.total)]));
      return shown;
    }
    if (sub === "new") {
      const c = await findClient(p[1] ?? f.client);
      const unbilled = await call("GET", `time?customerId=${c.id}&isBilled=false`);
      if (!unbilled.length) throw new UsageError(`No unbilled time for ${c.name}.`);
      const total = unbilled.reduce((t, e) => t + e.hours * (e.hourlyRate ?? 0), 0);
      if (!f.json) out(`${unbilled.length} unbilled ${unbilled.length === 1 ? "entry" : "entries"} for ${c.name}: ${hours(unbilled.reduce((t, e) => t + e.hours, 0))}, ${money(total)}.`);
      if (f["dry-run"]) return { dryRun: true, would: { client: c.name, entries: unbilled.length, total: total.toFixed(2) } };
      const inv = await call("POST", "invoices", { customerId: c.id, issueDate: today(), entryIds: unbilled.map((e) => e.id) });
      if (!f.json) out(green(`Draft ${inv.invoiceNumber} made. Preview it: ${cyan(`perhr invoice preview ${inv.invoiceNumber}`)}`));
      return inv;
    }
    if (sub === "preview") {
      if (!p[1]) throw new UsageError("perhr invoice preview <INV-0001>");
      const r = await call("GET", `invoices/${encodeURIComponent(p[1])}/preview`);
      if (!f.json) {
        out(`${bold(r.invoice.number)}  ${r.invoice.client ?? ""}  ${money(r.invoice.total)}  ${dim(`${r.invoice.status}, version ${r.invoice.version}`)}`);
        if (r.invoice.to.length) out(`To: ${r.invoice.to.join(", ")}`);
        for (const c of r.checks) out(`  ${c.level === "stop" ? yellow("■ Stops the send:") : c.level === "warning" ? yellow("▲") : dim("i")} ${c.message}${c.fix ? dim(`  → ${c.fix}`) : ""}`);
        out(r.canSend ? green("Ready to send. Sending is approved in your browser (coming in the next per.hr CLI release).") : "Fix what stops the send first.");
        if (f.open && r.invoice.url) openBrowser(r.invoice.url);
      }
      return r;
    }
    if (sub === "mark-sent" || sub === "mark-paid" || sub === "mark-unpaid") {
      if (!p[1]) throw new UsageError(`perhr invoice ${sub} <INV-0001>`);
      const status = { "mark-sent": "sent", "mark-paid": "paid", "mark-unpaid": "sent" }[sub];
      const body = { status, ...(sub === "mark-paid" && f.via ? { paymentMethod: f.via } : {}), ...(sub === "mark-paid" && f.date ? { paidAt: f.date } : {}) };
      if (f["dry-run"]) return { dryRun: true, would: { invoice: p[1], ...body } };
      await call("PATCH", `invoices/${encodeURIComponent(p[1])}`, body);
      if (!f.json) out(green("Saved."));
      return { ok: true };
    }
    if (sub === "open") {
      if (!p[1]) throw new UsageError("perhr invoice open <INV-0001>");
      const r = await call("GET", `invoices/${encodeURIComponent(p[1])}/preview`);
      const base = loadConfig().api || "https://per.hr";
      openBrowser(`${base}/invoices/${r.invoice.id}`);
      if (!f.json) out(`Opened ${r.invoice.number} in per.hr, where you can download the PDF.`);
      return { opened: r.invoice.id };
    }
    if (sub === "send") throw new UsageError("Sending from the terminal arrives in the next per.hr CLI release, approved in your browser. For now: perhr invoice preview, then send it in per.hr.");
    throw new UsageError("perhr invoice list | new <client> | preview <INV> | open <INV> | mark-sent | mark-paid | mark-unpaid");
  },

  async open(p) {
    const base = loadConfig().api || "https://per.hr";
    openBrowser(`${base}/${p[0] === "review" ? "work/review" : p[0] === "plan" ? "work" : "dashboard"}`);
    return { ok: true };
  },
};

// The plugin's session commands, answered by per.hr in plain text
export const SESSION = new Set(["start", "pause", "resume", "end", "done", "note"]);

export async function session(cmd, p, f) {
  const here = gitRemote();
  const text = await sessionCall({
    action: cmd,
    ...(p.length ? { ref: p.join(" ") } : {}),
    ...(typeof f.summary === "string" ? { summary: f.summary } : {}),
    ...(process.env.CLAUDE_SESSION_ID ? { sessionId: process.env.CLAUDE_SESSION_ID } : {}),
    ...(here ? { remote: here.remote ?? undefined, folder: here.root } : {}),
  });
  if (!f.json) out(text);
  return { reply: text };
}

export { choose };
