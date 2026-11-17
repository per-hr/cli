# perhr

Bill clients for your Claude Code work, from the terminal.

`perhr` is the per.hr CLI. It sets up [per.hr for AI](https://per.hr/ai), records your Claude Code sessions to the right client and project, and turns confirmed work into invoices, with the same checks as per.hr in your browser.

```
npx perhr setup
```

Setup signs this computer in (you approve a code at per.hr/device), then walks through your business, how clients pay you, your first client and project, the Claude Code plugin, and linking your code folders. Progress is saved on your account, so you can stop and pick it up on any computer.

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
| `perhr invoice list`, `new`, `preview`, `open`, `mark-sent`, `mark-paid` | Invoices (`open` shows it in per.hr, with the PDF) |
| `perhr start`, `pause`, `resume`, `end`, `done`, `note` | The session in this folder |

Every command takes `--json`. Writes take `--dry-run`.

Exit codes: `0` done, `1` error, `2` usage, `3` sign in first, `4` waiting on setup or approval, `5` not found.

## Inside Claude Code

Claude Code runs commands without a keyboard, so `perhr` never asks a question there. `/perhr:setup` has Claude ask in the chat, then runs each step with flags, for example:

```
perhr setup --step clients --name "Halcyon Coffee Roasters" --email ap@halcyon.coffee --basis time --project Website
```

Rates are typed at the keyboard. A command Claude runs can't set or change a rate; run that one yourself in a terminal (or with `!` in Claude Code).

When Claude runs a `perhr` command, its output enters the conversation. Typing `perhr` yourself keeps it out.

## What's stored on this computer

`~/.perhr/credentials.json` holds this computer's key, readable only by you. Disconnect it any time with `perhr logout`, or from per.hr under Configure → Developers.

## Requirements

Node 18.17 or later. macOS, Linux and Windows.
