/**
 * Pure formatter functions. No Obsidian dependencies — testable in plain Node.
 *
 * Gemini paste pattern (the bug we fix):
 *
 *     Bash
 *
 *     ```
 *     git diff main
 *     ```
 *
 * The bare language label sits on its own line, separated from the
 * un-tagged fence by a blank line. We rewrite it to a properly-tagged fence:
 *
 *     ```bash
 *     git diff main
 *     ```
 */

export interface FormatOptions {
	rewriteGeminiCodeFences: boolean;
	collapseBlankLines: boolean;
	trimTrailingWhitespace: boolean;
	ensureTrailingNewline: boolean;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
	rewriteGeminiCodeFences: true,
	collapseBlankLines: true,
	trimTrailingWhitespace: true,
	ensureTrailingNewline: true,
};

const KNOWN_LANGUAGES: Record<string, string> = {
	bash: 'bash',
	sh: 'bash',
	shell: 'bash',
	zsh: 'bash',
	console: 'bash',
	powershell: 'powershell',
	ps1: 'powershell',
	cmd: 'bat',
	bat: 'bat',
	python: 'python',
	py: 'python',
	javascript: 'javascript',
	js: 'javascript',
	typescript: 'typescript',
	ts: 'typescript',
	jsx: 'jsx',
	tsx: 'tsx',
	json: 'json',
	yaml: 'yaml',
	yml: 'yaml',
	toml: 'toml',
	xml: 'xml',
	html: 'html',
	css: 'css',
	scss: 'scss',
	sass: 'sass',
	go: 'go',
	golang: 'go',
	rust: 'rust',
	rs: 'rust',
	java: 'java',
	kotlin: 'kotlin',
	swift: 'swift',
	c: 'c',
	'c++': 'cpp',
	cpp: 'cpp',
	'c#': 'csharp',
	csharp: 'csharp',
	ruby: 'ruby',
	rb: 'ruby',
	php: 'php',
	sql: 'sql',
	dockerfile: 'dockerfile',
	docker: 'dockerfile',
	makefile: 'makefile',
	make: 'makefile',
	nginx: 'nginx',
	terraform: 'hcl',
	hcl: 'hcl',
	graphql: 'graphql',
	gql: 'graphql',
	markdown: 'markdown',
	md: 'markdown',
	plaintext: 'text',
	text: 'text',
	diff: 'diff',
	ini: 'ini',
	r: 'r',
	scala: 'scala',
	dart: 'dart',
	lua: 'lua',
	perl: 'perl',
	vim: 'vim',
};

/**
 * Maps a Gemini-style bare language label (e.g. "Bash", "C++", "JavaScript")
 * to its canonical fenced-code-block tag, or `null` if we don't recognize it.
 *
 * Recognition is intentionally strict: returning `null` keeps the original
 * text untouched so we never destroy a paragraph that just happens to be a
 * single capitalized word.
 */
export function canonicalLanguage(label: string): string | null {
	const normalized = label.trim().toLowerCase();
	return KNOWN_LANGUAGES[normalized] ?? null;
}

const UNTAGGED_FENCE = /^(\s*)(`{3,}|~{3,})\s*$/;
const FENCE_TOKEN = /^\s*(`{3,}|~{3,})(.*)$/;

interface FenceState {
	marker: '`' | '~';
	len: number;
}

/**
 * Updates fence state given a line. CommonMark rules: a closing fence must
 * use the same marker character as the opening fence, be at least as long,
 * and have no info string. Returns the new state.
 */
function updateFenceState(line: string, current: FenceState | null): FenceState | null {
	const m = line.match(FENCE_TOKEN);
	if (!m) return current;

	const token = m[1];
	const marker = token[0] as '`' | '~';
	const len = token.length;
	const rest = m[2].trim();

	if (current === null) {
		// Opening fence — info string is allowed.
		return { marker, len };
	}
	// Inside a fence — only an un-tagged, same-marker, ≥-length fence closes it.
	if (marker === current.marker && len >= current.len && rest === '') {
		return null;
	}
	return current;
}

/**
 * Rewrites the Gemini bare-language-label pattern into a properly-tagged
 * fenced code block.
 *
 * Tracks fence state so that a `Bash` line living inside an existing code
 * block (e.g. when documenting Gemini's bug) is left untouched.
 */
export function rewriteGeminiCodeFences(input: string): string {
	const lines = input.split('\n');
	const out: string[] = [];
	let fence: FenceState | null = null;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Only consider rewriting when we're outside any fenced block.
		if (fence === null) {
			const lang = canonicalLanguage(line);
			if (lang !== null) {
				let j = i + 1;
				while (j < lines.length && lines[j].trim() === '') j++;
				const fenceMatch = j < lines.length ? lines[j].match(UNTAGGED_FENCE) : null;
				if (fenceMatch) {
					const indent = fenceMatch[1];
					const fenceStr = fenceMatch[2];
					out.push(`${indent}${fenceStr}${lang}`);
					// We just emitted an opening fence; track it so the closing
					// fence (and the body in between) is handled correctly.
					fence = { marker: fenceStr[0] as '`' | '~', len: fenceStr.length };
					i = j + 1;
					continue;
				}
			}
		}

		fence = updateFenceState(line, fence);
		out.push(line);
		i++;
	}

	return out.join('\n');
}

/**
 * Collapses runs of 3+ blank lines into a single blank line. Preserves
 * single and double blank lines (which carry semantic meaning in Markdown).
 */
export function collapseBlankLines(input: string): string {
	return input.replace(/(?:[ \t]*\n){3,}/g, '\n\n');
}

/**
 * Strips trailing spaces/tabs from every line. Skips lines inside fenced
 * code blocks (whitespace can be meaningful). Fence lines themselves are
 * trimmed since trailing whitespace on a fence is never significant.
 */
export function trimTrailingWhitespace(input: string): string {
	const lines = input.split('\n');
	let fence: FenceState | null = null;

	return lines
		.map((line) => {
			const before = fence;
			fence = updateFenceState(line, fence);
			const insideBody = before !== null && fence !== null;
			return insideBody ? line : line.replace(/[ \t]+$/, '');
		})
		.join('\n');
}

/**
 * Ensures the document ends with exactly one trailing newline.
 *
 * Unsafe to call on partial pastes: turning `hello` into `hello\n` will
 * split a word in half if the user pastes mid-line. Use `formatPaste()`
 * for the paste hook.
 */
export function ensureTrailingNewline(input: string): string {
	return input.replace(/\n*$/, '\n');
}

/** Normalizes Windows/old-Mac line endings to LF. */
export function normalizeLineEndings(input: string): string {
	return input.replace(/\r\n?/g, '\n');
}

const IMAGE_EXT = '(?:png|jpe?g|gif|webp|svg|bmp|avif|tiff?|heic|ico)';

function imageWikilinkRegex(): RegExp {
	// Captures: 1 = name (incl. any path/anchor), 2 = optional `|...` size suffix.
	return new RegExp(
		`!\\[\\[([^\\]\\n|]+\\.${IMAGE_EXT})(\\|[^\\]\\n]*)?\\]\\]`,
		'gi'
	);
}

export interface ImageWikilinkMatch {
	line: number;
	startCh: number;
	endCh: number;
	name: string;
	hasSize: boolean;
}

/**
 * Locates Obsidian image wikilinks in `text` and reports their positions
 * as `{line, ch}` ranges. Used by the paste hook to splice `|size` into a
 * freshly-inserted link via `editor.replaceRange()` without rewriting the
 * whole document.
 */
export function findImageWikilinks(text: string): ImageWikilinkMatch[] {
	const re = imageWikilinkRegex();
	const out: ImageWikilinkMatch[] = [];
	const lines = text.split('\n');
	for (let line = 0; line < lines.length; line++) {
		const lineText = lines[line];
		for (const m of lineText.matchAll(re)) {
			const matchIndex = m.index ?? 0;
			out.push({
				line,
				startCh: matchIndex,
				endCh: matchIndex + m[0].length,
				name: m[1],
				hasSize: m[2] !== undefined,
			});
		}
	}
	return out;
}

/**
 * Appends `|<size>` to every Obsidian image wikilink that doesn't already
 * specify a size. Used as a batch transform; the paste hook does the same
 * thing positionally for cursor preservation. Non-positive or non-finite
 * sizes return the input unchanged.
 */
export function addImageWikilinkSize(input: string, size: number): string {
	if (!Number.isFinite(size) || size <= 0) return input;
	const re = imageWikilinkRegex();
	return input.replace(re, (match, name, sizePart) => {
		if (sizePart) return match;
		return `![[${name}|${size}]]`;
	});
}

/**
 * Given the editor content before and after a paste, plus the pre-paste
 * selection range as offsets, returns the inserted substring and the
 * offset where it ends in `after`. Returns `null` if nothing appears to
 * have been inserted.
 *
 * Used to find the region Obsidian just wrote so we can re-format it
 * after its HTML→Markdown conversion (which is what produces the Gemini
 * bug pattern in the first place — we can't catch it via `text/plain`).
 */
export function pastedSlice(
	before: string,
	after: string,
	fromOffset: number,
	toOffset: number
): { inserted: string; endOffset: number } | null {
	const insertedLen = after.length - before.length + (toOffset - fromOffset);
	if (insertedLen <= 0) return null;
	const inserted = after.slice(fromOffset, fromOffset + insertedLen);
	return { inserted, endOffset: fromOffset + insertedLen };
}

/**
 * Runs the full formatting pipeline. Each step is gated by `options`.
 * Always normalizes line endings first.
 */
export function format(input: string, options: FormatOptions = DEFAULT_FORMAT_OPTIONS): string {
	let result = normalizeLineEndings(input);
	if (options.rewriteGeminiCodeFences) result = rewriteGeminiCodeFences(result);
	if (options.collapseBlankLines) result = collapseBlankLines(result);
	if (options.trimTrailingWhitespace) result = trimTrailingWhitespace(result);
	if (options.ensureTrailingNewline) result = ensureTrailingNewline(result);
	return result;
}

/**
 * Paste-safe variant of `format()`. Skips `ensureTrailingNewline` because
 * pasting mid-line should not append a newline that fragments the
 * surrounding text.
 */
export function formatPaste(input: string, options: FormatOptions = DEFAULT_FORMAT_OPTIONS): string {
	return format(input, { ...options, ensureTrailingNewline: false });
}
