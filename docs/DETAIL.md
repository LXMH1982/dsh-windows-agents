# Global instructions

Edits the user-global `AGENTS.md` that DeepSeek Harness loads for every session, before any project-level instruction file. The page lives in **Settings** as its own section; the instructions themselves are injected by the harness, not by this plugin.

## What it does

- Shows one editor for the user-global instruction chain and saves it to `$DSH_HOME/AGENTS.md` (default `~/.dsh/AGENTS.md`), which `@deepseek-ai/dsh-agent-instructions` reads ahead of the project chain.
- Leaves injection, budget, and de-duplication to that package: this plugin writes the file and adds no prompt text of its own.
- Uses the harness settings document, so a save updates the running Host plugin in place and survives a restart.

## Behavior worth knowing

- **The file wins at startup.** If `AGENTS.md` differs from the saved text when the Host starts, the file's bytes are imported into the form. A hand-edited file is therefore never replaced by a stale saved value; the next save starts from the file's content.
- **Saving rewrites the file atomically**, through a temporary file and a rename, creating `$DSH_HOME` when it is missing.
- **Clearing removes the file**, which is the state the harness reads as "no user-global instructions". Other files are not touched.
- **New sessions see the change.** The instruction baseline is rendered for a session's first request, and a resumed session reconciles it; a session that is already running keeps the instructions it loaded.
- The counter shows the text's UTF-8 length against the 65,536-byte budget the instruction row uses per chain. A larger file is still saved, and the harness then truncates or omits files inside that chain and reports a budget notice to the model.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `content` | `''` | The instruction text. Volatile, so the settings form edits it without restarting the plugin. |
| `file` | `''` | Absolute path to maintain instead of `$DSH_HOME/AGENTS.md`. YAML-only; it never appears in the form. |

`file` is an ordinary field: changing it in the profile patch restarts the plugin, which then reads that path.
