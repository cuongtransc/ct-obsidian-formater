import { Editor, Notice, Plugin } from 'obsidian';
import { format, formatPaste } from './formatter';
import { DEFAULT_SETTINGS, FormatterSettings } from './types';
import { FormatterSettingTab } from './settings';

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
				if (!this.settings.formatOnPaste) return;
				if (evt.defaultPrevented) return;

				const text = evt.clipboardData?.getData('text/plain');
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
}
