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

		// Register markdown post processor for all content
		this.registerMarkdownPostProcessor((element) => {
			// Process all text nodes in the document
			const walker = document.createTreeWalker(
				element,
				NodeFilter.SHOW_TEXT,
				null
			);

			let node: Text | null;
			const nodesToReplace: { node: Text; newContent: string }[] = [];

			while ((node = walker.nextNode() as Text)) {
				const text = node.textContent || '';
				const startDelimiter = this.settings.variableDelimiters.start;
				const endDelimiter = this.settings.variableDelimiters.end;
				const regex = new RegExp(`${startDelimiter}(.*?)${endDelimiter}`, 'g');
				
				let modified = false;
				let newText = text;

				[...text.matchAll(regex)].forEach((match) => {
					const variable = match[1];
					const value = this.vaultProperties.getProperty(variable);
					if (value !== undefined) {
						const stringValue = this.stringifyValue(value);
						const displayValue = this.settings.highlightDynamicVariables 
							? `<span class="dynamic-variable" style="color: ${this.settings.dynamicVariableColor} !important">${stringValue}</span>`
							: stringValue;
						newText = newText.replace(match[0], displayValue);
						modified = true;
					}
				});

				if (modified) {
					nodesToReplace.push({ node, newContent: newText });
				}
			}

			// Apply all replacements
			nodesToReplace.forEach(({ node, newContent }) => {
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = newContent;
				const fragment = document.createDocumentFragment();
				while (tempDiv.firstChild) {
					fragment.appendChild(tempDiv.firstChild);
				}
				node.parentNode?.replaceChild(fragment, node);
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
					// Force a complete refresh of the view
					if (view.getMode() === 'preview') {
						view.previewMode.rerender();
					} else {
						view.editor.refresh();
					}
					
					// Force a complete refresh of the workspace
					this.app.workspace.trigger('resize');
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
					// Force a complete refresh of the view
					if (view.getMode() === 'preview') {
						view.previewMode.rerender();
					} else {
						view.editor.refresh();
					}
					
					// Force a complete refresh of the workspace
					this.app.workspace.trigger('resize');
				}
			})
		);

		// Register editor change event
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor, view) => {
				if (view instanceof MarkdownView && view.file) {
					// Update vault properties immediately
					this.vaultProperties.updateProperties(view.file);
					
					// Force a complete refresh of the view
					if (view.getMode() === 'preview') {
						view.previewMode.rerender();
					} else {
						view.editor.refresh();
					}
					
					// Force a complete refresh of the workspace
					this.app.workspace.trigger('resize');
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
		// Update code blocks
		const codeBlocks = view.contentEl.querySelectorAll('pre code');
		codeBlocks.forEach((codeBlock) => {
			const originalCode = codeBlock.getAttribute('data-original-code') || codeBlock.textContent || '';
			
			// Store original code if not already stored
			if (!codeBlock.getAttribute('data-original-code')) {
				codeBlock.setAttribute('data-original-code', originalCode);
				
				// Extract variables from the code
				const startDelimiter = this.settings.variableDelimiters.start;
				const endDelimiter = this.settings.variableDelimiters.end;
				const regex = new RegExp(`${startDelimiter}(.*?)${endDelimiter}`, 'g');
				const variables = [...originalCode.matchAll(regex)].map(match => match[1]);
				codeBlock.setAttribute('data-variables', JSON.stringify(variables));
			}
			
			const variables = JSON.parse(codeBlock.getAttribute('data-variables') || '[]');
			if (variables.length > 0) {
				let displayCode = originalCode;
				variables.forEach((variable: string) => {
					const value = this.vaultProperties.getProperty(variable);
					if (value !== undefined) {
						const stringValue = this.stringifyValue(value);
						const displayValue = this.settings.highlightDynamicVariables 
							? `<span class="dynamic-variable" style="color: ${this.settings.dynamicVariableColor} !important">${stringValue}</span>`
							: stringValue;
						displayCode = displayCode.replace(
							new RegExp(`${this.settings.variableDelimiters.start}${variable}${this.settings.variableDelimiters.end}`, 'g'),
							displayValue
						);
					}
				});
				codeBlock.innerHTML = displayCode;
			}
		});

		// Add copy event listener to code blocks
		codeBlocks.forEach((codeBlock) => {
			codeBlock.addEventListener('copy', (e: ClipboardEvent) => {
				const originalCode = codeBlock.getAttribute('data-original-code');
				const variables = JSON.parse(codeBlock.getAttribute('data-variables') || '[]');
				
				if (originalCode && variables.length > 0) {
					let displayCode = originalCode;
					variables.forEach((variable: string) => {
						const value = this.vaultProperties.getProperty(variable);
						if (value !== undefined) {
							const stringValue = this.stringifyValue(value);
							displayCode = displayCode.replace(
								new RegExp(`${this.settings.variableDelimiters.start}${variable}${this.settings.variableDelimiters.end}`, 'g'),
								stringValue
							);
						}
					});
					
					e.clipboardData?.setData('text/plain', displayCode);
					e.preventDefault();
				}
			});
		});

		// Update all spans with variables
		const spans = view.contentEl.querySelectorAll('span[query]');
		spans.forEach((span) => {
			const query = span.getAttribute('query');
			if (query) {
				const value = tryComputeValueFromQuery(query, this.vaultProperties, this.settings);
				if (value !== undefined) {
					const stringValue = this.stringifyValue(value);
					const displayValue = this.settings.highlightDynamicVariables 
						? `<span class="dynamic-variable" style="color: ${this.settings.dynamicVariableColor} !important">${stringValue}</span>`
						: stringValue;
					span.innerHTML = displayValue;
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
