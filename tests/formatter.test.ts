import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import {
	addImageWikilinkSize,
	canonicalLanguage,
	collapseBlankLines,
	ensureTrailingNewline,
	findImageWikilinks,
	format,
	formatPaste,
	normalizeLineEndings,
	pastedSlice,
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

describe('addImageWikilinkSize', () => {
	test('appends size to a bare image wikilink', () => {
		assert.equal(
			addImageWikilinkSize('![[Pasted image 20260508104252.png]]', 1000),
			'![[Pasted image 20260508104252.png|1000]]'
		);
	});

	test('leaves wikilinks that already have a size alone', () => {
		const input = '![[image.png|500]]';
		assert.equal(addImageWikilinkSize(input, 1000), input);
	});

	test('handles multiple links in one document', () => {
		const input = '![[a.png]]\nsome text\n![[b.jpg]]';
		const expected = '![[a.png|1000]]\nsome text\n![[b.jpg|1000]]';
		assert.equal(addImageWikilinkSize(input, 1000), expected);
	});

	test('only matches recognized image extensions', () => {
		const input = '![[note.md]]\n![[doc.pdf]]\n![[img.png]]';
		const expected = '![[note.md]]\n![[doc.pdf]]\n![[img.png|1000]]';
		assert.equal(addImageWikilinkSize(input, 1000), expected);
	});

	test('matches uppercase extensions', () => {
		assert.equal(addImageWikilinkSize('![[A.PNG]]', 1000), '![[A.PNG|1000]]');
	});

	test('does not modify regular wikilinks without leading !', () => {
		const input = '[[image.png]]';
		assert.equal(addImageWikilinkSize(input, 1000), input);
	});

	test('handles subpath embeds', () => {
		assert.equal(
			addImageWikilinkSize('![[attachments/diagram.svg]]', 1000),
			'![[attachments/diagram.svg|1000]]'
		);
	});

	test('returns input unchanged for non-positive or non-finite sizes', () => {
		const input = '![[image.png]]';
		assert.equal(addImageWikilinkSize(input, 0), input);
		assert.equal(addImageWikilinkSize(input, -10), input);
		assert.equal(addImageWikilinkSize(input, NaN), input);
	});
});

describe('findImageWikilinks', () => {
	test('locates positions across lines and reports hasSize correctly', () => {
		const text = 'hello\nstart ![[a.png]] end\n![[b.png|500]]';
		const matches = findImageWikilinks(text);
		assert.equal(matches.length, 2);
		assert.deepEqual(matches[0], {
			line: 1,
			startCh: 6,
			endCh: 6 + '![[a.png]]'.length,
			name: 'a.png',
			hasSize: false,
		});
		assert.deepEqual(matches[1], {
			line: 2,
			startCh: 0,
			endCh: '![[b.png|500]]'.length,
			name: 'b.png',
			hasSize: true,
		});
	});

	test('returns an empty array when there are no image wikilinks', () => {
		assert.deepEqual(findImageWikilinks('just some text\n[[a regular note]]'), []);
	});

	test('insert position endCh-2 lands right before the closing ]]', () => {
		const text = '![[Pasted image 20260508104252.png]]';
		const [m] = findImageWikilinks(text);
		assert.equal(text.slice(m.endCh - 2, m.endCh), ']]');
		const patched = text.slice(0, m.endCh - 2) + '|1000' + text.slice(m.endCh - 2);
		assert.equal(patched, '![[Pasted image 20260508104252.png|1000]]');
	});
});

describe('pastedSlice', () => {
	test('returns the inserted text and end offset for an insertion at a point', () => {
		const before = 'abXYef';
		const after = 'abHELLOXYef';
		const result = pastedSlice(before, after, 2, 2);
		assert.deepEqual(result, { inserted: 'HELLO', endOffset: 7 });
	});

	test('handles a paste that replaces a non-empty selection', () => {
		const before = 'abcdef';
		const after = 'aXef';
		const result = pastedSlice(before, after, 1, 4);
		assert.deepEqual(result, { inserted: 'X', endOffset: 2 });
	});

	test('handles multi-line paste', () => {
		const before = 'hello\nworld';
		const after = 'hello\nFOO\nworld';
		const result = pastedSlice(before, after, 6, 6);
		assert.deepEqual(result, { inserted: 'FOO\n', endOffset: 10 });
	});

	test('returns null when nothing was inserted (empty paste over empty selection)', () => {
		assert.equal(pastedSlice('abc', 'abc', 1, 1), null);
	});

	test('returns null when content shrank (e.g. paste replaced selection with empty)', () => {
		assert.equal(pastedSlice('abcdef', 'ac', 1, 4), null);
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
