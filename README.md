# perhr

Bill clients for your Claude Code work, from the terminal.

`perhr` is the per.hr CLI. It sets up [per.hr for AI](https://per.hr/ai), records your Claude Code sessions to the right client and project, and turns confirmed work into invoices, with the same checks as per.hr in your browser.

```
npx perhr setup
```

Setup signs this computer in (you approve a code at per.hr/device), then walks through your business, how clients pay you, your first client and project, the Claude Code plugin, and linking your code folders. Progress is saved on your account, so you can stop and pick it up on any computer.

The Claude Code step installs the per.hr plugin and, with your OK, adds per.hr's rules to your Claude Code settings: reads run without asking, and every change shows Claude Code's own prompt with the full command. It also adds per.hr's status line (the Plan item, today's hours and anything waiting) when you don't have one yet. Your previous settings file is saved beside it as `settings.json.perhr-backup`.

## Commands

| | |
|---|---|
| `perhr setup`, `perhr setup status` | Set up per.hr for AI; see what's left |
| `perhr login`, `logout`, `whoami` | Sign this computer in or out |
| `perhr status` | The session recording now, today's hours, and anything waiting |
| `perhr doctor` | Check the key, setup and the connection |
| `perhr keys` | Computers and keys signed in to per.hr; `perhr keys disconnect <id>` |
| `perhr workspace use <name>` | Choose the workspace for folders that aren't linked |
| `perhr client list`, `add`, `show`, `edit`, `emails`, `archive` | Clients, their addresses and how AI work is billed |
| `perhr project list`, `add` | Projects |
| `perhr repo list`, `link` | Which project each code folder records to |
| `perhr time list`, `log` | Time |
| `perhr plan list`, `add` | Plan items |
| `perhr review` | To Review: `confirm`, `dismiss`, `undo` |
| `perhr invoice list`, `new`, `preview`, `open`, `send`, `remind`, `mark-sent`, `mark-paid` | Invoices (`open` shows it in per.hr, with the PDF) |
| `perhr estimate list`, `preview`, `open`, `send` | Estimates |
| `perhr start`, `pause`, `resume`, `end`, `done`, `note` | The session in this folder |
| `perhr statusline` | One line for Claude Code's status line |

Every command takes `--json`. Writes take `--dry-run`.

## Sending

`perhr invoice send INV-0042` (or several, or `--all-ready` for every draft) previews each one and runs the same checks as Send in per.hr, then gives you a link: you approve the send on per.hr in your browser, on any device where you're signed in, with a checkbox for each invoice. Nothing goes out until you do, and anything that changed since its preview has to be previewed again. `--test` sends the exact email to you only, with no approval. Estimates work the same way with `perhr estimate send`, and payment reminders with `perhr invoice remind INV-0042` (it shows how long the invoice has waited; one reminder per invoice every 3 days).

Exit codes: `0` done, `1` error, `2` usage, `3` sign in first, `4` waiting on setup or approval, `5` not found.

## Inside Claude Code

Claude Code runs commands without a keyboard, so `perhr` never asks a question there. `/perhr:setup` has Claude ask in the chat, then runs each step with flags, for example:

```
perhr setup --step clients --name "Halcyon Coffee Roasters" --email ap@halcyon.coffee --basis time --project Website
```

Rates are typed at the keyboard. A command Claude runs can't set or change a rate; run that one yourself in a terminal (or with `!` in Claude Code).

When Claude runs a `perhr` command, its output enters the conversation. Typing `perhr` yourself keeps it out.

## What's stored on this computer

`~/.perhr/credentials.json` holds this computer's key, readable only by you. Disconnect it any time with `perhr logout`, or from per.hr under Configure → Developers. A key from before the CLI (the plugin's settings or `~/.perhr/key`) keeps working until this computer signs in.

The Claude Code plugin keeps each repo folder's current session in `~/.perhr/state/`, and events waiting for per.hr in `~/.perhr/queue.jsonl` when it can't be reached.

## Requirements

Node 18.17 or later. macOS, Linux and Windows.
