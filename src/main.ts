import { Notice, Plugin, TFile } from 'obsidian';
import { tryComputeValueFromQuery } from './VariableQueryParser';
import { stringifyIfObj, trancateString } from './utils';
import {
	DEFAULT_SETTINGS,
	LiveVariablesSettings,
} from './LiveVariablesSettings';
import { LiveVariablesSettingTab } from './LiveVariablesSettingTab';
import VaultProperties from './VaultProperties';
import queryVariablesCommand from './commands/query-variables';
import insertGlobalVariableCommand from './commands/insert-global-variable';
import insertLocalVariableCommand from './commands/insert-local-variable';
import metadataCacheChangeEvent from './events/metadata-cache-change';
import activeLeafChangeEvent from './events/active-leaf-change';
import { unescape } from 'he';

export default class LiveVariables extends Plugin {
	public settings: LiveVariablesSettings;
	public vaultProperties: VaultProperties;

	async onload() {
		await this.loadSettings();

		this.vaultProperties = new VaultProperties(this.app);

		this.registerEvent(activeLeafChangeEvent(this));
		this.registerEvent(metadataCacheChangeEvent(this));

		this.addCommand(insertLocalVariableCommand(this));
		this.addCommand(insertGlobalVariableCommand(this));
		this.addCommand(queryVariablesCommand(this));

		this.addSettingTab(new LiveVariablesSettingTab(this.app, this));

		// Add observer for code block updates
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.updateCodeBlocks();
			})
		);
	}

	renderVariables(file: TFile) {
		this.renderVariablesV1(file);
		this.renderVariablesV2(file);
		this.renderVariablesV3(file);
	}

	renderVariablesV1(file: TFile) {
		const re = new RegExp(
			String.raw`<span id="([^"]+)"\/>.*?<span type="end"\/>`,
			'g'
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const key = match[1];
				const value = this.vaultProperties.getProperty(key);
				if (value) {
					data = data.replace(
						match[0],
						`<span query="get(${key})"></span>${stringifyIfObj(
							value
						)}<span type="end"></span>`
					);
				} else {
					data = data.replace(
						match[0],
						`<span query="get(${key})"></span><span style="color: red">Live Variable Error</span><span type="end"></span>`
					);
					new Notice(
						`Failed to get value of variable ${trancateString(
							key,
							50
						)}`
					);
				}
			});
			return data;
		});
	}

	renderVariablesV2(file: TFile) {
		const re = new RegExp(
			String.raw`<span query="([^"]+)"\/>[\s\S]*?<span type="end"\/>`,
			'g'
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const escapedQuery = match[1];
				const query = unescape(escapedQuery);
				const value = tryComputeValueFromQuery(
					query,
					this.vaultProperties,
					this.settings
				);
				if (value !== undefined) {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${stringifyIfObj(
							value
						)}<span type="end"></span>`
					);
				} else {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${this.errorSpan(
							'Invalid Query'
						)}<span type="end"></span>`
					);
					new Notice(
						`Failed to get value of query "${trancateString(
							escapedQuery,
							50
						)}"`
					);
				}
			});
			return data;
		});
	}

	renderVariablesV3(file: TFile) {
		const re = new RegExp(
			String.raw`<span query="([^"]+?)"><\/span>[\s\S]*?<span type="end"><\/span>`,
			'g'
		);
		const codeBlockRe = new RegExp(
			String.raw`\`\`\`(\w+)\n([\s\S]*?)\n\`\`\``,
			'g'
		);
		this.app.vault.process(file, (data) => {
			// Process code blocks first
			data = data.replace(codeBlockRe, (match, lang, code) => {
				const startDelimiter = this.settings.variableDelimiters.start;
				const endDelimiter = this.settings.variableDelimiters.end;
				const regex = new RegExp(`${startDelimiter}(.*?)${endDelimiter}`, 'g');
				let hasVariables = false;

				// Find all variables in the code block
				const variables = [...code.matchAll(regex)].map(m => m[1]);
				
				if (variables.length > 0) {
					hasVariables = true;
					// Create a display version with replaced values
					let displayCode = code;
					variables.forEach(variable => {
						const value = this.vaultProperties.getProperty(variable);
						if (value !== undefined) {
							displayCode = displayCode.replace(
								new RegExp(`${startDelimiter}${variable}${endDelimiter}`, 'g'),
								value.toString()
							);
						}
					});

					// Return the code block with replaced values and original code in data attribute
					return `<div class="code-block-wrapper" data-original-code="${encodeURIComponent(code)}">\`\`\`${lang}\n${displayCode}\n\`\`\`</div>`;
				}

				// If no variables were found, return the original code block
				return match;
			});

			// Then process regular variable spans
			[...data.matchAll(re)].forEach((match) => {
				const escapedQuery = match[1];
				const query = unescape(escapedQuery);
				const value = tryComputeValueFromQuery(
					query,
					this.vaultProperties,
					this.settings
				);
				if (value !== undefined) {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${stringifyIfObj(
							value
						)}<span type="end"></span>`
					);
				} else {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${this.errorSpan(
							'Invalid Query'
						)}<span type="end"></span>`
					);
					new Notice(
						`Failed to get value of query "${trancateString(
							escapedQuery,
							50
						)}"`
					);
				}
			});
			return data;
		});
	}

	errorSpan = (message: string) => {
		return `<span style="color: red">Error: ${message}</span>`;
	};

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateCodeBlocks() {
		const codeBlocks = document.querySelectorAll('.code-block-wrapper');
		codeBlocks.forEach((block) => {
			const originalCode = decodeURIComponent(block.getAttribute('data-original-code') || '');
			const lang = block.querySelector('code')?.className.replace('language-', '') || '';
			const startDelimiter = this.settings.variableDelimiters.start;
			const endDelimiter = this.settings.variableDelimiters.end;
			const regex = new RegExp(`${startDelimiter}(.*?)${endDelimiter}`, 'g');

			let displayCode = originalCode;
			const variables = [...originalCode.matchAll(regex)].map(m => m[1]);
			
			variables.forEach(variable => {
				const value = this.vaultProperties.getProperty(variable);
				if (value !== undefined) {
					displayCode = displayCode.replace(
						new RegExp(`${startDelimiter}${variable}${endDelimiter}`, 'g'),
						value.toString()
					);
				}
			});

			const codeElement = block.querySelector('code');
			if (codeElement) {
				codeElement.textContent = displayCode;
			}
		});
	}
}
