import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import {
	canonicalLanguage,
	collapseBlankLines,
	ensureTrailingNewline,
	format,
	formatPaste,
	normalizeLineEndings,
	rewriteGeminiCodeFences,
	trimTrailingWhitespace,
} from '../src/formatter';

describe('canonicalLanguage', () => {
	test('maps common labels regardless of case', () => {
		assert.equal(canonicalLanguage('Bash'), 'bash');
		assert.equal(canonicalLanguage('PYTHON'), 'python');
		assert.equal(canonicalLanguage('  TypeScript  '), 'typescript');
		assert.equal(canonicalLanguage('C++'), 'cpp');
	});

	test('returns null for unknown labels', () => {
		assert.equal(canonicalLanguage('Hello world'), null);
		assert.equal(canonicalLanguage('Some paragraph'), null);
		assert.equal(canonicalLanguage(''), null);
	});
});

describe('rewriteGeminiCodeFences', () => {
	test('rewrites the canonical Gemini pattern from the PRD', () => {
		const input = [
			'To see every difference between the tip of `main` and the tip of your current branch:',
			'',
			'Bash',
			'',
			'```',
			'git diff main',
			'```',
			'',
		].join('\n');

		const expected = [
			'To see every difference between the tip of `main` and the tip of your current branch:',
			'',
			'```bash',
			'git diff main',
			'```',
			'',
		].join('\n');

		assert.equal(rewriteGeminiCodeFences(input), expected);
	});

	test('handles multiple Gemini code blocks in one document', () => {
		const input = [
			'Bash',
			'',
			'```',
			'git diff main',
			'```',
			'',
			'Python',
			'',
			'```',
			'print("hi")',
			'```',
		].join('\n');

		const expected = [
			'```bash',
			'git diff main',
			'```',
			'',
			'```python',
			'print("hi")',
			'```',
		].join('\n');

		assert.equal(rewriteGeminiCodeFences(input), expected);
	});

	test('leaves already-tagged fences untouched', () => {
		const input = '```bash\ngit status\n```\n';
		assert.equal(rewriteGeminiCodeFences(input), input);
	});

	test('does not rewrite paragraphs that happen to be a single word', () => {
		const input = 'Bash\n\nThis is just a paragraph.\n';
		assert.equal(rewriteGeminiCodeFences(input), input);
	});

	test('preserves a label that is followed by content rather than a fence', () => {
		const input = 'Bash is a shell.\n\n```\necho hi\n```\n';
		assert.equal(rewriteGeminiCodeFences(input), input);
	});

	test('handles tilde fences', () => {
		const input = 'JavaScript\n\n~~~\nconsole.log(1)\n~~~\n';
		const expected = '~~~javascript\nconsole.log(1)\n~~~\n';
		assert.equal(rewriteGeminiCodeFences(input), expected);
	});

	test('handles indented fences', () => {
		const input = 'Python\n\n  ```\n  print("hi")\n  ```\n';
		const expected = '  ```python\n  print("hi")\n  ```\n';
		assert.equal(rewriteGeminiCodeFences(input), expected);
	});

	test('handles label and fence with no blank line between them', () => {
		const input = 'Bash\n```\nfoo\n```\n';
		const expected = '```bash\nfoo\n```\n';
		assert.equal(rewriteGeminiCodeFences(input), expected);
	});

	test('handles multiple blank lines between label and fence', () => {
		const input = 'Bash\n\n\n```\nfoo\n```\n';
		const expected = '```bash\nfoo\n```\n';
		assert.equal(rewriteGeminiCodeFences(input), expected);
	});

	test('does not rewrite labels inside an existing fenced code block', () => {
		// A 4-backtick outer fence demonstrating Gemini's bug. The inner
		// "Bash\n\n```" is content, not a pattern to rewrite.
		const input = [
			'````',
			'Bash',
			'',
			'```',
			'git diff',
			'```',
			'````',
		].join('\n');
		assert.equal(rewriteGeminiCodeFences(input), input);
	});

	test('preserves fence length when rewriting (4-backtick fences stay 4)', () => {
		const input = 'Bash\n\n````\nfoo\n````\n';
		const expected = '````bash\nfoo\n````\n';
		assert.equal(rewriteGeminiCodeFences(input), expected);
	});

	test('does not consume blank lines when no fence follows', () => {
		const input = 'Bash\n\n\nNot a fence.\n';
		assert.equal(rewriteGeminiCodeFences(input), input);
	});
});

describe('collapseBlankLines', () => {
	test('collapses 3+ blank lines into one', () => {
		assert.equal(collapseBlankLines('a\n\n\n\nb'), 'a\n\nb');
		assert.equal(collapseBlankLines('a\n\n\nb'), 'a\n\nb');
	});

	test('leaves single and double newlines alone', () => {
		assert.equal(collapseBlankLines('a\nb'), 'a\nb');
		assert.equal(collapseBlankLines('a\n\nb'), 'a\n\nb');
	});

	test('treats whitespace-only lines as blank', () => {
		assert.equal(collapseBlankLines('a\n   \n\t\n\nb'), 'a\n\nb');
	});
});

describe('trimTrailingWhitespace', () => {
	test('strips trailing spaces and tabs from prose lines', () => {
		assert.equal(trimTrailingWhitespace('hello   \nworld\t\n'), 'hello\nworld\n');
	});

	test('preserves trailing whitespace inside fenced code blocks', () => {
		const input = '```\n  indented   \n```\n';
		assert.equal(trimTrailingWhitespace(input), input);
	});

	test('trims fence lines themselves', () => {
		const input = '```bash   \nfoo\n```   \n';
		const expected = '```bash\nfoo\n```\n';
		assert.equal(trimTrailingWhitespace(input), expected);
	});

	test('does not confuse a tilde fence with a backtick fence inside', () => {
		// Content ``` inside a ~~~ fence must not toggle state.
		const input = '~~~\n```\nstill inside\n```\n~~~\n';
		const expected = input; // Trim should be no-op here.
		assert.equal(trimTrailingWhitespace(input), expected);
	});
});

describe('ensureTrailingNewline', () => {
	test('adds a newline when missing', () => {
		assert.equal(ensureTrailingNewline('hello'), 'hello\n');
	});

	test('collapses multiple trailing newlines to one', () => {
		assert.equal(ensureTrailingNewline('hello\n\n\n'), 'hello\n');
	});

	test('leaves a single trailing newline alone', () => {
		assert.equal(ensureTrailingNewline('hello\n'), 'hello\n');
	});
});

describe('normalizeLineEndings', () => {
	test('converts CRLF to LF', () => {
		assert.equal(normalizeLineEndings('a\r\nb\r\n'), 'a\nb\n');
	});

	test('converts lone CR to LF', () => {
		assert.equal(normalizeLineEndings('a\rb\r'), 'a\nb\n');
	});

	test('leaves LF-only input unchanged', () => {
		assert.equal(normalizeLineEndings('a\nb\n'), 'a\nb\n');
	});
});

describe('format pipeline', () => {
	test('full pipeline against the PRD example', () => {
		const input = [
			'To compare your current branch against `main`, use the following commands depending on the desired output:',
			'',
			'### 1. Direct Comparison',
			'',
			'To see every difference between the tip of `main` and the tip of your current branch:',
			'',
			'Bash',
			'',
			'```',
			'git diff main',
			'```',
			'',
			'### 2. Compare from Divergence (Recommended for PRs)',
			'',
			'Bash',
			'',
			'```',
			'git diff main...',
			'```',
			'',
			'',
			'',
			'### 3. Summary of Changes   ',
			'',
			'Bash',
			'',
			'```',
			'git diff main --stat',
			'```',
		].join('\n');

		const result = format(input);

		assert.match(result, /```bash\ngit diff main\n```/);
		assert.match(result, /```bash\ngit diff main\.\.\.\n```/);
		assert.match(result, /```bash\ngit diff main --stat\n```/);
		assert.doesNotMatch(result, /\n{3,}/);
		assert.doesNotMatch(result, /[ \t]+\n/);
		assert.ok(result.endsWith('\n'));
	});

	test('handles CRLF input end-to-end', () => {
		const input = 'Bash\r\n\r\n```\r\nfoo\r\n```\r\n';
		const expected = '```bash\nfoo\n```\n';
		assert.equal(format(input), expected);
	});

	test('disabled options are no-ops', () => {
		const input = 'Bash\n\n```\nfoo\n```\n\n\n';
		const result = format(input, {
			rewriteGeminiCodeFences: false,
			collapseBlankLines: false,
			trimTrailingWhitespace: false,
			ensureTrailingNewline: false,
		});
		assert.equal(result, input);
	});

	test('idempotent — running twice equals running once', () => {
		const input = 'Bash\n\n```\nfoo   \n```\n\n\n';
		const once = format(input);
		const twice = format(once);
		assert.equal(once, twice);
	});

	test('empty input survives', () => {
		assert.equal(format(''), '\n');
	});
});

describe('formatPaste', () => {
	test('does not append a trailing newline', () => {
		// Critical: pasting "hello world" mid-line must not insert a newline.
		assert.equal(formatPaste('hello world'), 'hello world');
	});

	test('still rewrites Gemini fences', () => {
		const input = 'Bash\n\n```\nfoo\n```';
		const expected = '```bash\nfoo\n```';
		assert.equal(formatPaste(input), expected);
	});

	test('still normalizes CRLF', () => {
		assert.equal(formatPaste('a\r\nb'), 'a\nb');
	});
});
