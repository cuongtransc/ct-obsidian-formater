import { App, PluginSettingTab, Setting } from 'obsidian';
import type FormatterPlugin from './main';

export class FormatterSettingTab extends PluginSettingTab {
	plugin: FormatterPlugin;

	constructor(app: App, plugin: FormatterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'CT Obsidian Formatter' });

		new Setting(containerEl)
			.setName('Format on paste')
			.setDesc('Automatically reformat text when pasting into a Markdown note.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.formatOnPaste).onChange(async (value) => {
					this.plugin.settings.formatOnPaste = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Rewrite Gemini code fences')
			.setDesc('Detect "Bash\\n\\n```" patterns from Gemini and rewrite them as ```bash.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.rewriteGeminiCodeFences).onChange(async (value) => {
					this.plugin.settings.rewriteGeminiCodeFences = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Collapse blank lines')
			.setDesc('Collapse runs of 3 or more blank lines into a single blank line.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.collapseBlankLines).onChange(async (value) => {
					this.plugin.settings.collapseBlankLines = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Trim trailing whitespace')
			.setDesc('Remove trailing spaces/tabs from each line (skips fenced code blocks).')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.trimTrailingWhitespace).onChange(async (value) => {
					this.plugin.settings.trimTrailingWhitespace = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Ensure trailing newline')
			.setDesc('Make sure files end with exactly one newline character.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.ensureTrailingNewline).onChange(async (value) => {
					this.plugin.settings.ensureTrailingNewline = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
