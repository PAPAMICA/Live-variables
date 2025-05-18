import { App, PluginSettingTab, Setting, DropdownComponent } from 'obsidian';
import LiveVariables from './main';
import { getTranslations } from './i18n';

export class LiveVariablesSettingTab extends PluginSettingTab {
	plugin: LiveVariables;

	constructor(app: App, plugin: LiveVariables) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const t = getTranslations(this.plugin.settings.language);

		containerEl.empty();

		// Language setting
		new Setting(containerEl)
			.setName(t.settings.language.name)
			.setDesc(t.settings.language.desc)
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown
					.addOption('en', 'English')
					.addOption('fr', 'Français')
					.setValue(this.plugin.settings.language)
					.onChange(async (value: 'en' | 'fr') => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh display to update language
					});
			});

		// Variable delimiters
		new Setting(containerEl)
			.setName(t.settings.delimiters.name)
			.setDesc(t.settings.delimiters.desc)
			.addText((text) =>
				text
					.setPlaceholder('{{')
					.setValue(this.plugin.settings.variableDelimiters.start)
					.onChange(async (value) => {
						this.plugin.settings.variableDelimiters.start = value;
						await this.plugin.saveSettings();
					})
			)
			.addText((text) =>
				text
					.setPlaceholder('}}')
					.setValue(this.plugin.settings.variableDelimiters.end)
					.onChange(async (value) => {
						this.plugin.settings.variableDelimiters.end = value;
						await this.plugin.saveSettings();
					})
			);

		// Highlight variables
		new Setting(containerEl)
			.setName(t.settings.highlight.name)
			.setDesc(t.settings.highlight.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.highlightDynamicVariables)
					.onChange(async (value) => {
						this.plugin.settings.highlightDynamicVariables = value;
						await this.plugin.saveSettings();
					})
			);

		// Highlight color
		new Setting(containerEl)
			.setName(t.settings.color.name)
			.setDesc(t.settings.color.desc)
			.addColorPicker((colorPicker) =>
				colorPicker
					.setValue(this.plugin.settings.dynamicVariableColor)
					.onChange(async (value) => {
						this.plugin.settings.dynamicVariableColor = value;
						await this.plugin.saveSettings();
					})
			);
	}
} 