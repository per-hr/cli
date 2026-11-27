# perhr

Bill clients for your Claude Code and Codex work, from the terminal.

`perhr` is the per.hr CLI. It sets up [per.hr for AI](https://per.hr/ai), records your Claude Code and Codex sessions to the right client and project, and turns confirmed work into invoices, with the same checks as per.hr in your browser.

```
npx perhr setup
```

Setup signs this computer in (you approve a code at per.hr/device), then walks through your business, how clients pay you, your first client and project, the Claude Code plugin, Codex if you use it, and linking your code folders. Progress is saved on your account, so you can stop and pick it up on any computer.

The Claude Code step installs the per.hr plugin and, with your OK, adds per.hr's rules to your Claude Code settings: reads run without asking, and every change shows Claude Code's own prompt with the full command. It also adds per.hr's status line (the Plan item, today's hours and anything waiting) when you don't have one yet. Your previous settings file is saved beside it as `settings.json.perhr-backup`.

The Codex step adds per.hr's hooks to Codex's `hooks.json`; the previous file is saved beside it as `hooks.json.perhr-backup`. The next time you start Codex, it shows Hooks need review: look over what each one runs and press `t` to approve them. per.hr records from then on. On a computer that's already set up, `perhr setup --step codex` adds Codex, and `perhr setup --step codex --remove` takes per.hr's hooks out and leaves any others in place. More: [per.hr With Codex](https://per.hr/ai/codex).

## per.hr Desktop

Today's time and your agents in the system tray (Windows) or menu bar (Mac), with a notice when an agent waits on you or a session is ready for Review. On a computer signed in to per.hr, run:

```
npx perhr@latest desktop
```

`perhr setup` offers it too. It keeps itself, the per.hr CLI and the Claude Code plugin up to date. `perhr desktop --check` shows the installed and newest versions.

## A Client's Own Payment Details

By default every client's invoices show your payment details from per.hr (Configure → Get Paid). A client can have its own instead, such as a different bank account. `perhr client add` asks, in your own terminal, whether the new client uses your defaults; answer no to enter its own. `perhr client edit <client> --payment` changes them later, and `perhr client show` says which set applies. These are typed at the keyboard only: when Claude Code or a script runs perhr, it never asks for them or shows them, the same as rates. Or use Edit Client → Payment Details in per.hr.

## Commands

| | |
|---|---|
| `perhr setup`, `perhr setup status` | Set up per.hr for AI; see what's left |
| `perhr setup --step codex` | Add per.hr's hooks to Codex; `--remove` takes them out |
| `perhr login`, `logout`, `whoami` | Sign this computer in or out |
| `perhr uninstall` | Take per.hr off this computer: the key, the plugin, its rules and compute in your Claude Code settings, per.hr's hooks in Codex, and `~/.perhr`. Your account and data stay |
| `perhr status` | The session recording now, today's hours, and anything waiting |
| `perhr doctor` | Check the key, setup and the connection, and whether Codex has run per.hr's hooks |
| `perhr update` | Install a newer perhr now, or turn daily updates on or off (`perhr update --on` / `--off`) |
| `perhr desktop` | Install per.hr Desktop, the tray (Windows) or menu bar (Mac) app with today's time and your agents, on a computer signed in to per.hr. `--check` shows the installed and newest versions. The app updates itself after that |
| `perhr keys` | Computers and keys signed in to per.hr; `perhr keys disconnect <id>` |
| `perhr workspace use <name>` | Choose the workspace for folders that aren't linked |
| `perhr client list`, `add`, `show`, `edit`, `emails`, `archive` | Clients, their addresses and how AI work is billed |
| `perhr project list`, `add` | Projects |
| `perhr repo list`, `link` | Which project each code folder records to |
| `perhr time list`, `log` | Time |
| `perhr plan list`, `add` | Plan items |
| `perhr review` | Review: `confirm`, `dismiss`, `undo` |
| `perhr invoice list`, `new`, `preview`, `open`, `send`, `remind`, `mark-sent`, `mark-paid` | Invoices (`open` shows it in per.hr, with the PDF) |
| `perhr estimate list`, `preview`, `open`, `send` | Estimates |
| `perhr team list`, `invite`, `cancel`, `role`, `hours`, `remove` | A team's people and invites (owners and admins change them) |
| `perhr timesheets`, `approve`, `send-back`, `reopen`, `submit`, `withdraw` | The week's timesheets |
| `perhr pay`, `pay file`, `pay open` | What's due, the PayPal payouts file to upload yourself, and the Pay page |
| `perhr start`, `pause`, `resume`, `end`, `done`, `note` | The session in this folder |
| `perhr statusline` | One line for Claude Code's status line |

Every command takes `--json`. Writes take `--dry-run`.

## Sending

`perhr invoice send INV-0042` (or several, or `--all-ready` for every draft) previews each one and runs the same checks as Send in per.hr, then gives you a link: you approve the send on per.hr in your browser, on any device where you're signed in, with a checkbox for each invoice. Nothing goes out until you do, and anything that changed since its preview has to be previewed again. `--test` sends the exact email to you only, with no approval. Estimates work the same way with `perhr estimate send`, and payment reminders with `perhr invoice remind INV-0042` (it shows how long the invoice has waited; one reminder per invoice every 3 days).

Exit codes: `0` done, `1` error, `2` usage, `3` sign in first, `4` waiting on setup or approval, `5` not found.

## Teams

In a team, run `perhr workspace use "<team name>"` first (or work in a repo linked to one of the team's projects). Everyone signs their own computer in with `perhr login`; each repo records to the workspace where it's linked. Owners and admins manage the team; members see their own time and submit their week. per.hr keeps the pay record and never moves money: `perhr pay file` saves the PayPal payouts file for you to upload, and you mark people paid on per.hr's Pay page.

## Inside Claude Code

Claude Code runs commands without a keyboard, so `perhr` never asks a question there. `/perhr:setup` has Claude ask in the chat, then runs each step with flags, for example:

```
perhr setup --step clients --name "Halcyon Coffee Roasters" --email ap@halcyon.coffee --basis time --project Website
```

Rates are typed at the keyboard. A command Claude runs can't set or change a rate; run that one yourself in a terminal (or with `!` in Claude Code).

When Claude runs a `perhr` command, its output enters the conversation. Typing `perhr` yourself keeps it out.

## What's stored on this computer

`~/.perhr/credentials.json` holds this computer's key, readable only by you. Disconnect it any time with `perhr logout`, or from per.hr under Configure → per.hr for AI. A key from before the CLI (the plugin's settings or `~/.perhr/key`) keeps working until this computer signs in.

The Claude Code plugin keeps each repo folder's current session in `~/.perhr/state/`, and events waiting for per.hr in `~/.perhr/queue.jsonl` when it can't be reached.

The Codex hook is a copy of per.hr's script in `~/.perhr/codex/`. It sends what the plugin sends (the session, its times, the repo and branch), Codex's token counts by model, and the `per.hr note:` line Codex ends a reply with, which becomes the session's summary. Your prompts, your code and the rest of Codex's replies stay on your computer. Token counts wait in `~/.perhr/codex-usage/` until the turn ends.

With your OK, setup also adds compute (cost, tokens, models, commits) to your Claude Code settings, using this computer's key. `perhr uninstall` removes everything setup added and saves your previous settings file beside it as `settings.json.perhr-backup`.

## Requirements

Node 18.17 or later. macOS, Linux and Windows. Codex recording has been run on Windows so far.
