import { App, PluginSettingTab, Setting } from 'obsidian';
import LiveVariables from './main';

export class LiveVariablesSettingTab extends PluginSettingTab {
	plugin: LiveVariables;

	constructor(app: App, plugin: LiveVariables) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Délimiteurs de variables')
			.setDesc('Définir les délimiteurs pour les variables')
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

		new Setting(containerEl)
			.setName('Surligner les variables dynamiques')
			.setDesc('Surligner les variables avec une couleur pour les distinguer du texte normal')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.highlightDynamicVariables)
					.onChange(async (value) => {
						this.plugin.settings.highlightDynamicVariables = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Couleur de surlignage')
			.setDesc('Choisir la couleur pour les variables surlignées')
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