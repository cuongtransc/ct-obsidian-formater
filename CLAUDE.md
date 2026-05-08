# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**CT Obsidian Formatter** — an Obsidian plugin that reformats notes pasted from Gemini (and similar LLM web UIs) into clean Obsidian-flavored Markdown.

The headline transform: Gemini emits code blocks as a bare language label, blank line, and un-tagged fence (`Bash\n\n\`\`\`\n…\n\`\`\``). This plugin rewrites the fence into a properly-tagged one (`\`\`\`bash`).

## Architecture

- `src/formatter.ts` — pure functions, no Obsidian imports. All formatting logic lives here so it can be unit-tested with `node:test`. Keep it dependency-free.
- `src/main.ts` — the only file that talks to the Obsidian API. Wires commands and the `editor-paste` event to the formatter.
- `src/settings.ts` / `src/types.ts` — settings tab and shape.
- `tests/formatter.test.ts` — `node:test` suite. Run with `mise run test`.

When adding a new transform: add a pure function to `formatter.ts`, expose a toggle on `FormatterSettings`, render it in the settings tab, and gate it inside `format()`.

## Commands

```bash
mise run dev         # esbuild watch
mise run build       # tsc check + production bundle
mise run typecheck   # tsc -noEmit
mise run test        # node:test
```

Built artifacts land in `dist/`. Copy that folder into `<vault>/.obsidian/plugins/ct-obsidian-formater/` to install locally.

## Conventions

- Tabs for indentation (matches the Obsidian sample-plugin style and existing files).
- Keep `formatter.ts` Obsidian-free — never import from `obsidian` there.
- Write a `node:test` case for any new formatting rule before wiring it into the plugin.
- Prefer toggleable transforms over hardcoded behavior; users have strong opinions about Markdown.

## License

MIT.
