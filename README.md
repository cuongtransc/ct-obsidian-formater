# CT Obsidian Formatter

An Obsidian plugin that cleans up Markdown pasted from AI assistants — primarily **Gemini** — and applies light Markdown lint fixes.

## What it fixes

Gemini renders code blocks as a bare language label, a blank line, and an un-tagged fence:

````
Bash

```
git diff main
```
````

When pasted into Obsidian this produces an unstyled fence and an orphan `Bash` paragraph. This plugin rewrites it to:

````
```bash
git diff main
```
````

It also:

- collapses runs of 3+ blank lines into one
- trims trailing whitespace from prose (skips fenced code blocks)
- ensures the file ends in a single newline

All transforms are individually toggleable in **Settings → CT Obsidian Formatter**.

## Commands

| Command | Description |
| --- | --- |
| **Format current note** | Run the full formatter pipeline on the active note. |
| **Format selection** | Apply the formatter to the current selection only. |

The formatter also runs automatically on paste when **Format on paste** is enabled (default).

## Development

```bash
mise run install     # install deps
mise run dev         # esbuild watch mode → dist/main.js
mise run build       # production build
mise run typecheck   # tsc -noEmit
mise run test        # node:test against src/formatter.ts
mise run deploy      # build + install into a local Obsidian vault (prompts)
```

The build emits `dist/main.js`, `dist/manifest.json`, and `dist/styles.css`.

### Installing into a vault

Run `mise run deploy`. The script will:

1. Build the plugin (via the `build` task dependency).
2. Prompt for an Obsidian vault path. `~` is expanded; the path must contain a `.obsidian/` directory.
3. Copy `dist/*` into `<vault>/.obsidian/plugins/ct-obsidian-formater/`, creating the folder if needed.

Vault paths you enter are remembered in `.deploy-vaults.json` (gitignored). On subsequent runs you can pick a saved vault by number, choose `a` to deploy to all of them, or `n` to add a new one.

To install manually instead, copy `dist/` into `<your-vault>/.obsidian/plugins/ct-obsidian-formater/` and enable the plugin in Obsidian's community-plugin settings.

### Project layout

```
src/
  main.ts        Plugin entry — commands, paste hook, settings wiring
  formatter.ts   Pure transforms (no Obsidian deps, fully unit-tested)
  settings.ts    Settings tab UI
  types.ts       Settings interface + defaults
  styles.css     (placeholder — no UI styles needed)
tests/
  formatter.test.ts   node:test suite covering every transform
scripts/
  esbuild.config.mjs  Bundler config
  version-bump.mjs    Release helper
  deploy.mjs          Interactive vault deployer (used by `mise run deploy`)
```

`formatter.ts` is intentionally kept Obsidian-free so the logic can be unit-tested without spinning up a vault. `main.ts` is the only file that imports `obsidian`.

## License

MIT
