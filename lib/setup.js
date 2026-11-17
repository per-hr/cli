import { execFileSync } from "node:child_process";
import { call } from "./api.js";
import { loadKey } from "./config.js";
import { login } from "./login.js";
import { bold, choose, confirm, cyan, dim, green, money, openBrowser, out, tty, value, yellow } from "./ui.js";
import { gitRemote } from "./git.js";

// `perhr setup`: the ten steps, in a terminal with questions, or one step at a time with flags
// (`perhr setup --step business --business-name "Studio Lark" …`), which is how /perhr:setup runs
// them from Claude Code after asking in the chat. Progress is saved on the account.

export const STEPS = ["work", "account", "business", "paid", "clients", "claude", "repos", "check", "try", "done"];

const email = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter an email address.");
const rate = (v) => (Number(v) > 0 && Number(v) <= 100000 ? null : "Enter an hourly rate, like 125.");

function line(s) {
  const mark = !s.applies ? dim("-") : s.done ? green("✓") : yellow("○");
  return `  ${mark} ${s.applies ? s.title : dim(`${s.title} (the team's owner does this)`)}`;
}

export async function setupStatus({ json }) {
  const s = await call("GET", "setup");
  if (json) return s;
  out(bold("per.hr setup"));
  for (const st of s.steps) out(line(st));
  if (s.beta) out(dim(`\nper.hr for AI: ${s.beta.approval}${s.beta.trialEndsAt ? `, trial until ${String(s.beta.trialEndsAt).slice(0, 10)}` : ""}`));
  out(s.next ? `\nNext: ${cyan(`perhr setup --step ${s.next}`)}` : `\n${green("Setup is done.")}`);
  return s;
}

const STEP = {
  async work(f) {
    const work = await choose(f, "work", "How do you work?", [
      { id: "solo", label: "On my own, for clients" },
      { id: "shop", label: "A small dev shop with a few people" },
      { id: "member", label: "On someone else's team" },
    ]);
    await call("PATCH", "setup/work", { work });
    out(green("Saved."));
  },

  async account(f) {
    if (!loadKey()) await login({ open: !f["no-browser"] });
    const s = await call("GET", "setup");
    if (s.beta?.approval === "none") {
      const note = await value(f, "note", "Anything per.hr should know (optional)", { required: false });
      const r = await call("POST", "access/request", { note });
      out(r.approval === "queued" ? yellow("Your request is in line. You'll get an email when it's approved.") : green("Requested. You can set up and work now while per.hr reviews it."));
    } else out(green(`Signed in. per.hr for AI: ${s.beta?.approval}.`));
  },

  async business(f, s) {
    if (!s.business) return out(dim("The team's owner or an admin sets up the business. Nothing to do here."));
    const b = s.business;
    const businessName = await value(f, "business-name", "Business name", { required: false, fallback: b.businessName ?? undefined });
    const name = b.personal ? await value(f, "name", "Your name", { fallback: b.name ?? undefined }) : null;
    const address = await value(f, "address", "Address clients see on invoices", { fallback: b.address ?? undefined });
    const businessEmail = await value(f, "email", "Reply email for clients", { fallback: b.businessEmail ?? undefined, check: email });
    const body = { businessName, address, businessEmail, ...(b.personal ? { name } : {}) };
    // The rate is typed here, at the keyboard; Claude Code can't pass one in
    let defaultRate = null;
    if (tty()) defaultRate = Number(await value(f, "rate", "Default hourly rate (USD)", { fallback: b.defaultRate ?? undefined, check: rate }));
    else if (f.rate) throw new Error("Rates are typed at the keyboard. Run perhr setup --step business yourself in a terminal to set the rate.");
    await call("PATCH", b.personal ? "profile" : "workspace", { ...body, ...(defaultRate ? { defaultRate } : {}) }, { interactive: !!defaultRate });
    out(green("Saved."));
    if (!defaultRate && !b.defaultRate) out(yellow(`Set your rate yourself in a terminal: ${cyan("perhr setup --step business")}`));
  },

  async paid(f, s) {
    if (!s.paid) return out(dim("The team's owner sets up how clients pay. Nothing to do here."));
    const p = s.paid;
    if (p.stripe || p.paypal) out(green(`Connected: ${[p.stripe && "Stripe", p.paypal && "PayPal"].filter(Boolean).join(" and ")}.`));
    const how = f.stripe ? "stripe" : f.zelle || f.venmo || f.other || f.paypal || f.payoneer ? "instructions" : await choose(f, "how", "How do clients pay you?", [
      { id: "stripe", label: "Cards and bank transfers through Stripe", hint: "Stripe can take a few days to verify; instructions work meanwhile" },
      { id: "instructions", label: "Payment instructions on the invoice", hint: "Zelle, Venmo, PayPal, Payoneer, or anything else" },
      ...(p.stripe || p.paypal ? [{ id: "keep", label: "Keep what's connected" }] : []),
    ]);
    if (how === "stripe") {
      const r = await call("POST", "payouts/stripe", { returnTo: "/setup/claude-code" });
      if (r.connected) return out(green("Stripe is connected."));
      out(`Finish connecting on Stripe: ${cyan(r.url)}`);
      openBrowser(r.url);
      return;
    }
    if (how === "keep") return;
    const fields = {
      paymentZelle: await value(f, "zelle", "Zelle (email or phone)", { required: false, fallback: p.zelle ?? undefined }),
      paymentVenmo: await value(f, "venmo", "Venmo (@username)", { required: false, fallback: p.venmo ?? undefined }),
      paymentPaypal: await value(f, "paypal", "PayPal (email or paypal.me link)", { required: false, fallback: p.paypalContact ?? undefined }),
      paymentPayoneer: await value(f, "payoneer", "Payoneer (link)", { required: false, fallback: p.payoneer ?? undefined }),
      paymentOther: await value(f, "other", "Other instructions (bank, check)", { required: false, fallback: p.other ?? undefined }),
    };
    if (!Object.values(fields).some(Boolean)) throw new Error("Add at least one way to pay.");
    await call("PATCH", s.business?.personal ? "profile" : "workspace", fields);
    out(green("Saved."));
  },

  async clients(f, s) {
    if (!s.business) return out(dim("The team's owner or an admin adds clients. Nothing to do here."));
    for (const c of s.setupClients ?? []) out(`  ${c.name} ${dim(c.email ?? "no email")} ${c.verified ? green("confirmed") : c.sentAt ? yellow("waiting") : dim("not sent")}  ${dim(c.projects.map((p) => p.name).join(", "))}`);
    if ((s.setupClients ?? []).some((c) => c.email && c.projects.length) && !f.name && !(await confirm(f, "Add another client?", false))) return;
    const name = await value(f, "name", "Client name");
    const clientEmail = await value(f, "email", "Their invoice email", { check: email });
    let c;
    try {
      c = await call("POST", "clients", { name, email: clientEmail, allowDuplicate: !!f["allow-duplicate"] });
    } catch (e) {
      if (e.status === 409) throw new Error(`${e.message} Use --allow-duplicate to add another one with the same name.`);
      throw e;
    }
    const basis = await choose(f, "basis", "How is AI work billed for this client?", [
      { id: "time", label: "Hours Worked", hint: "your time, prompting and reviewing" },
      { id: "delivered", label: "Agreed Hours", hint: "the hours agreed for each Plan item" },
    ]);
    await call("PATCH", `clients/${c.id}/ai`, { basis, private: f["show-ai"] ? false : true });
    const project = await value(f, "project", "Project name", { fallback: name });
    let projectRate = null;
    if (tty()) projectRate = await value(f, "project-rate", "Hourly rate for this project (Enter for your default)", { required: false, check: rate });
    await call("POST", "projects", { name: project, customerId: c.id, ...(projectRate ? { hourlyRate: Number(projectRate) } : {}) }, { interactive: !!projectRate });
    out(green(`Added ${name}, with ${project}.`));
    out(dim(`${name} confirms their address before invoices email them. Until then you can download the PDF and send it yourself.`));
    if (await confirm(f, `Send ${clientEmail} the confirmation email now?`, !!f.send)) {
      await call("POST", `clients/${c.id}/confirmation`, {});
      out(green("Sent."));
    }
  },

  async claude(f) {
    out("Installing the per.hr plugin for Claude Code…");
    try {
      execFileSync("claude", ["plugin", "install", "perhr@perhr", "--marketplace", "per-hr/claude-code-plugin", "--scope", "user", "--yes", "--json"], { stdio: f.json ? "ignore" : "inherit", shell: process.platform === "win32" });
      out(green("Installed."));
    } catch {
      throw new Error("Couldn't run claude. Install Claude Code first (https://claude.com/claude-code), then run perhr setup --step claude again.");
    }
    out(dim("What Claude sees: when Claude runs a perhr command, its output enters the conversation. Rates you type in setup never pass through Claude. Typing perhr yourself keeps the output out of it."));
  },

  async repos(f, s) {
    const here = gitRemote();
    out(dim("These are the git folders on this computer where you run Claude Code. per.hr never reads your code; it records which folder a session ran in."));
    const repo = f.repo ?? here?.repo;
    if (!repo) throw new Error("Run this inside a git folder, or pass --repo owner/name.");
    const projects = s.projects ?? [];
    if (!projects.length) throw new Error("Add a client and project first: perhr setup --step clients");
    const projectId = f.project
      ? (projects.find((p) => p.id === f.project || p.name.toLowerCase() === String(f.project).toLowerCase())?.id ?? null)
      : await choose(f, "project", `Which project is ${bold(repo)} for?`, projects.map((p) => ({ id: p.id, label: p.name, hint: p.clientName ?? "" })));
    if (!projectId) throw new Error(`No project named ${f.project}.`);
    const existing = (s.repos ?? []).find((r) => r.repo.toLowerCase() === repo.toLowerCase());
    if (existing) await call("PATCH", `repos/${existing.id}`, { projectId });
    else await call("POST", "repos", { repo, projectId });
    out(green(`Linked ${repo}.`));
    const client = projects.find((p) => p.id === projectId)?.clientName;
    out(dim(`Keep AI Private is on for ${client ?? "this client"}: invoices never mention AI, agent time, compute or models. Change it with perhr client edit "${client ?? ""}" --show-ai.`));
  },

  async check() {
    const d = await call("GET", "doctor");
    for (const c of d.checks) out(`  ${c.ok ? green("✓") : yellow("○")} ${c.message}${c.ok || !c.fix ? "" : dim(`  → ${c.fix}`)}`);
  },

  async try() {
    out("In Claude Code, in a linked folder:");
    out(`  1. Ask for a small change.`);
    out(`  2. Run ${cyan("/perhr:end")} when it's done.`);
    out(`  3. Open ${cyan("perhr review")} to see the session.`);
  },

  async done() {
    await setupStatus({ json: false });
  },
};

export async function setup(f) {
  if (f.step) {
    if (!STEP[f.step]) throw new Error(`Steps: ${STEPS.join(", ")}.`);
    const s = f.step === "account" ? null : await call("GET", "setup");
    await STEP[f.step](f, s);
    return f.json ? call("GET", "setup") : undefined;
  }
  // The whole thing, in order, skipping what's done
  if (!tty()) throw new Error("Run perhr setup in a terminal, or one step at a time with --step (perhr setup status shows what's left).");
  out(bold("Set up per.hr for AI") + dim("  (stop anytime; progress is saved)"));
  if (!loadKey()) {
    out(`\n${bold("Your Account")}`);
    await STEP.account(f);
  }
  for (const step of STEPS) {
    const s = await call("GET", "setup");
    const st = s.steps.find((x) => x.id === step);
    if (!st?.applies || (st.done && step !== "check")) continue;
    out(`\n${bold(st.title)}`);
    await STEP[step](f, s);
  }
}

export { money };
