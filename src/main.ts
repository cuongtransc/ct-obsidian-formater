import { Editor, Notice, Plugin } from 'obsidian';
import { findImageWikilinks, format, formatPaste, pastedSlice } from './formatter';
import { DEFAULT_SETTINGS, FormatterSettings } from './types';
import { FormatterSettingTab } from './settings';

function clipboardHasImage(data: DataTransfer | null): boolean {
	if (!data) return false;
	for (let i = 0; i < data.files.length; i++) {
		if (data.files[i].type.startsWith('image/')) return true;
	}
	return false;
}

export default class FormatterPlugin extends Plugin {
	settings: FormatterSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new FormatterSettingTab(this.app, this));

		this.addCommand({
			id: 'format-current-note',
			name: 'Format current note',
			editorCallback: (editor: Editor) => {
				this.formatEditor(editor);
			},
		});

		this.addCommand({
			id: 'format-selection',
			name: 'Format selection',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('No selection to format.');
					return;
				}
				editor.replaceSelection(formatPaste(selection, this.settings));
			},
		});

		this.registerEvent(
			this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor) => {
				if (evt.defaultPrevented) return;

				if (this.settings.setImageSizeOnPaste && clipboardHasImage(evt.clipboardData)) {
					// Don't preventDefault — Obsidian needs to save the file and
					// insert the wikilink. Snapshot now and patch the new link
					// once the insertion lands.
					const snapshot = editor.getValue();
					window.setTimeout(() => this.patchPastedImageLink(editor, snapshot), 300);
				}

				if (!this.settings.formatOnPaste) return;
				if (!evt.clipboardData) return;

				// Gemini's bug pattern (`Bash\n\n```\n…\n```\n`) is produced by
				// Obsidian's HTML→Markdown converter, not by Gemini's text/plain
				// export. So when HTML is on the clipboard, we have to format
				// what Obsidian *inserts*, not what's in the clipboard. Snapshot
				// now and reformat the inserted region on the next tick.
				if (evt.clipboardData.types.includes('text/html')) {
					const before = editor.getValue();
					const fromOffset = editor.posToOffset(editor.getCursor('from'));
					const toOffset = editor.posToOffset(editor.getCursor('to'));
					window.setTimeout(
						() => this.formatPastedRegion(editor, before, fromOffset, toOffset),
						0
					);
					return;
				}

				const text = evt.clipboardData.getData('text/plain');
				if (!text) return;

				const formatted = formatPaste(text, this.settings);
				if (formatted === text) return;

				evt.preventDefault();
				editor.replaceSelection(formatted);
			})
		);

		console.log('CT Obsidian Formatter loaded');
	}

	onunload() {
		console.log('CT Obsidian Formatter unloaded');
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private formatEditor(editor: Editor) {
		const original = editor.getValue();
		const formatted = format(original, this.settings);
		if (formatted === original) {
			new Notice('Note already clean.');
			return;
		}

		const cursor = editor.getCursor();
		editor.setValue(formatted);
		editor.setCursor(this.clampCursor(editor, cursor));
		new Notice('Note formatted.');
	}

	private clampCursor(editor: Editor, pos: { line: number; ch: number }) {
		const lineCount = editor.lineCount();
		const line = Math.max(0, Math.min(pos.line, lineCount - 1));
		const ch = Math.max(0, Math.min(pos.ch, editor.getLine(line).length));
		return { line, ch };
	}

	private formatPastedRegion(
		editor: Editor,
		before: string,
		fromOffset: number,
		toOffset: number
	) {
		const slice = pastedSlice(before, editor.getValue(), fromOffset, toOffset);
		if (!slice) return;

		const formatted = formatPaste(slice.inserted, this.settings);
		if (formatted === slice.inserted) return;

		editor.replaceRange(
			formatted,
			editor.offsetToPos(fromOffset),
			editor.offsetToPos(slice.endOffset)
		);
	}

	private patchPastedImageLink(editor: Editor, before: string) {
		const after = editor.getValue();
		if (after === before) return;

		const beforeNames = new Set(findImageWikilinks(before).map((l) => l.name));
		const newUnsized = findImageWikilinks(after).filter(
			(l) => !l.hasSize && !beforeNames.has(l.name)
		);
		if (newUnsized.length === 0) return;

		const insertion = `|${this.settings.pastedImageSize}`;
		// Apply in reverse so earlier match positions remain valid as we edit.
		for (let i = newUnsized.length - 1; i >= 0; i--) {
			const link = newUnsized[i];
			const insertPos = { line: link.line, ch: link.endCh - 2 };
			editor.replaceRange(insertion, insertPos, insertPos);
		}
	}
}
