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
import { MarkdownView } from 'obsidian';

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

		// Register markdown post processor for code blocks
		this.registerMarkdownPostProcessor((element) => {
			const codeBlocks = element.querySelectorAll('pre code');
			codeBlocks.forEach((codeBlock) => {
				const code = codeBlock.textContent || '';
				const startDelimiter = this.settings.variableDelimiters.start;
				const endDelimiter = this.settings.variableDelimiters.end;
				const regex = new RegExp(`${startDelimiter}(.*?)${endDelimiter}`, 'g');
				
				const variables = [...code.matchAll(regex)].map(m => m[1]);
				if (variables.length > 0) {
					// Store original code and variables in data attributes
					codeBlock.setAttribute('data-original-code', code);
					codeBlock.setAttribute('data-variables', JSON.stringify(variables));

					let displayCode = code;
					variables.forEach((variable: string) => {
						const value = this.vaultProperties.getProperty(variable);
						if (value !== undefined) {
							displayCode = displayCode.replace(
								new RegExp(`${startDelimiter}${variable}${endDelimiter}`, 'g'),
								this.stringifyValue(value)
							);
						}
					});
					codeBlock.textContent = displayCode;

					// Add copy button handler
					const copyButton = codeBlock.parentElement?.querySelector('.copy-code-button');
					if (copyButton) {
						copyButton.addEventListener('click', (e) => {
							e.preventDefault();
							e.stopPropagation();
							navigator.clipboard.writeText(displayCode);
						});
					}
				}
			});
		});

		// Register file change event
		this.registerEvent(
			this.app.vault.on('modify', (file: TFile) => {
				// Update vault properties immediately
				this.vaultProperties.updateProperties(file);
				
				// Get the active view
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view && view.file === file) {
					// Force immediate update of all code blocks
					setTimeout(() => {
						this.updateCodeBlocksWithVariables(view);
						// Force a complete refresh of the view
						if (view.getMode() === 'preview') {
							view.previewMode.rerender();
						} else {
							view.editor.refresh();
						}
						// Force a complete refresh of the workspace
						this.app.workspace.trigger('resize');
					}, 0);
				}
			})
		);

		// Register metadata cache change event
		this.registerEvent(
			this.app.metadataCache.on('changed', (file: TFile) => {
				// Update vault properties immediately
				this.vaultProperties.updateProperties(file);
				
				// Get the active view
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view && view.file === file) {
					// Force immediate update of all code blocks
					setTimeout(() => {
						this.updateCodeBlocksWithVariables(view);
						// Force a complete refresh of the view
						if (view.getMode() === 'preview') {
							view.previewMode.rerender();
						} else {
							view.editor.refresh();
						}
						// Force a complete refresh of the workspace
						this.app.workspace.trigger('resize');
					}, 0);
				}
			})
		);
	}

	refreshView(file: TFile) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file === file) {
			// Update vault properties
			this.vaultProperties.updateProperties(file);

			// Force a complete refresh of the view
			if (view.getMode() === 'preview') {
				// For preview mode, we need to force a complete re-render
				view.previewMode.rerender();
			} else {
				// For source mode, we need to refresh the editor
				view.editor.refresh();
			}

			// Force a complete refresh of the workspace
			this.app.workspace.trigger('resize');

			// Update all code blocks with variables
			this.updateCodeBlocksWithVariables(view);
		}
	}

	updateCodeBlocksWithVariables(view: MarkdownView) {
		const codeBlocks = view.contentEl.querySelectorAll('pre code');
		codeBlocks.forEach((codeBlock) => {
			const originalCode = codeBlock.getAttribute('data-original-code');
			if (originalCode) {
				const variables = JSON.parse(codeBlock.getAttribute('data-variables') || '[]');
				if (variables.length > 0) {
					// Create a temporary container to preserve formatting
					const tempContainer = document.createElement('div');
					tempContainer.innerHTML = codeBlock.innerHTML;
					
					// Find all text nodes that might contain variables
					const walker = document.createTreeWalker(
						tempContainer,
						NodeFilter.SHOW_TEXT,
						null
					);
					
					let node: Text | null;
					while ((node = walker.nextNode() as Text)) {
						let text = node.textContent || '';
						let modified = false;
						
						variables.forEach((variable: string) => {
							const value = this.vaultProperties.getProperty(variable);
							if (value !== undefined) {
								const regex = new RegExp(`${this.settings.variableDelimiters.start}${variable}${this.settings.variableDelimiters.end}`, 'g');
								const newText = text.replace(regex, this.stringifyValue(value));
								if (newText !== text) {
									text = newText;
									modified = true;
								}
							}
						});
						
						if (modified) {
							node.textContent = text;
						}
					}
					
					// Update only the text content while preserving all formatting
					const originalHTML = codeBlock.innerHTML;
					codeBlock.innerHTML = tempContainer.innerHTML;
					
					// Restore any lost classes or attributes
					if (codeBlock.className !== originalHTML) {
						codeBlock.className = originalHTML;
					}

					// Update the copy button handler with the new display code
					const copyButton = codeBlock.parentElement?.querySelector('.copy-code-button');
					if (copyButton) {
						copyButton.removeEventListener('click', () => {});
						copyButton.addEventListener('click', (e) => {
							e.preventDefault();
							e.stopPropagation();
							navigator.clipboard.writeText(codeBlock.textContent || '');
						});
					}
				}
			}
		});
	}

	stringifyValue(value: any): string {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (typeof value === 'object') {
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}
		return String(value);
	}

	renderVariables(file: TFile) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file === file) {
			// Get all code blocks in the current view
			const codeBlocks = view.contentEl.querySelectorAll('pre code');
			
			codeBlocks.forEach((codeBlock) => {
				const originalCode = codeBlock.getAttribute('data-original-code') || codeBlock.textContent || '';
				const variables = JSON.parse(codeBlock.getAttribute('data-variables') || '[]');
				
				if (variables.length > 0) {
					const startDelimiter = this.settings.variableDelimiters.start;
					const endDelimiter = this.settings.variableDelimiters.end;
					
					// Create a temporary container to hold the code
					const tempContainer = document.createElement('div');
					tempContainer.innerHTML = codeBlock.innerHTML;
					
					// Find all text nodes that might contain variables
					const walker = document.createTreeWalker(
						tempContainer,
						NodeFilter.SHOW_TEXT,
						null
					);
					
					let node: Text | null;
					while ((node = walker.nextNode() as Text)) {
						let text = node.textContent || '';
						let modified = false;
						
						variables.forEach((variable: string) => {
							const value = this.vaultProperties.getProperty(variable);
							if (value !== undefined) {
								const regex = new RegExp(`${startDelimiter}${variable}${endDelimiter}`, 'g');
								const newText = text.replace(regex, this.stringifyValue(value));
								if (newText !== text) {
									text = newText;
									modified = true;
								}
							}
						});
						
						if (modified) {
							node.textContent = text;
						}
					}
					
					// Update the code block content while preserving formatting
					codeBlock.innerHTML = tempContainer.innerHTML;
				}
			});
		}
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
		this.app.vault.process(file, (data) => {
			// Process regular variable spans
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
}
