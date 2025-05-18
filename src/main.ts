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
	private styleElement: HTMLStyleElement | null = null;
	private activeTooltip: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.vaultProperties = new VaultProperties(this.app);

		this.registerEvent(activeLeafChangeEvent(this));
		this.registerEvent(metadataCacheChangeEvent(this));

		this.addCommand(insertLocalVariableCommand(this));
		this.addCommand(insertGlobalVariableCommand(this));
		this.addCommand(queryVariablesCommand(this));

		this.addSettingTab(new LiveVariablesSettingTab(this.app, this));
		
		// Add a CSS rule to ensure variable highlighting works correctly
		this.addStylesheet(`
			.dynamic-variable {
				color: ${this.settings.dynamicVariableColor} !important;
				display: inline !important;
				background: none !important;
				padding: 0 !important;
				margin: 0 !important;
				border: none !important;
				font-weight: inherit !important;
				font-style: inherit !important;
				font-size: inherit !important;
				font-family: inherit !important;
				line-height: inherit !important;
				text-decoration: inherit !important;
				pointer-events: inherit !important;
				cursor: pointer !important;
				position: relative;
				border-bottom: 1px dotted ${this.settings.dynamicVariableColor} !important;
			}
			
			.dynamic-variable:hover {
				background-color: rgba(0, 0, 0, 0.1) !important;
			}
			
			.variable-edit-tooltip {
				position: absolute;
				z-index: 1000;
				background-color: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				padding: 8px;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
				min-width: 200px;
				font-family: var(--font-interface);
			}
			
			.variable-edit-tooltip h5 {
				margin: 0 0 8px 0;
				font-size: 14px;
				font-weight: 600;
				color: var(--text-normal);
			}
			
			.variable-edit-tooltip input {
				width: 100%;
				margin-bottom: 8px;
				background-color: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				color: var(--text-normal);
				padding: 4px 8px;
				border-radius: 4px;
			}
			
			.variable-edit-tooltip .tooltip-buttons {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
			}
			
			.variable-edit-tooltip button {
				padding: 4px 8px;
				background-color: var(--interactive-normal);
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				color: var(--text-normal);
				cursor: pointer;
				font-size: 12px;
			}
			
			.variable-edit-tooltip button.primary {
				background-color: var(--interactive-accent);
				color: var(--text-on-accent);
			}
			
			.variable-edit-tooltip button:hover {
				background-color: var(--interactive-hover);
			}
			
			.variable-edit-tooltip button.primary:hover {
				background-color: var(--interactive-accent-hover);
			}
		`);

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
							? `<span class="dynamic-variable" data-variable="${variable}">${stringValue}</span>`
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
			
			// Add click handlers for variable editing
			this.setupVariableEditHandlers(element);
			
			// Override code block copy functionality
			this.modifyCodeBlockCopyButtons(element);
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
		
		// Also listen for any workspace layout changes to ensure we catch new code blocks
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// Find all views and modify their code blocks
				this.app.workspace.iterateRootLeaves((leaf) => {
					if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
						this.modifyCodeBlockCopyButtons(leaf.view.containerEl);
					}
				});
			})
		);
		
		// Listen for active leaf changes to update code blocks in the newly active view
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf && leaf.view) {
					if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
						setTimeout(() => {
							// Small delay to ensure the DOM is fully updated
							this.modifyCodeBlockCopyButtons(leaf.view.containerEl);
						}, 100);
					}
				}
			})
		);
	}
	
	// Set up click handlers for editing variables
	setupVariableEditHandlers(element: HTMLElement) {
		const variables = element.querySelectorAll('.dynamic-variable');
		variables.forEach(varEl => {
			varEl.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				
				// Get the variable name
				const variable = varEl.getAttribute('data-variable');
				if (!variable) return;
				
				// Get the current value
				const currentValue = this.vaultProperties.getProperty(variable) || '';
				
				// Create the tooltip
				this.showVariableEditTooltip(varEl as HTMLElement, variable, currentValue.toString());
			});
		});
	}
	
	// Create and show the variable edit tooltip
	showVariableEditTooltip(element: HTMLElement, variable: string, currentValue: string) {
		// Close any existing tooltip
		this.closeActiveTooltip();
		
		// Create tooltip
		const tooltip = document.createElement('div');
		tooltip.className = 'variable-edit-tooltip';
		
		// Create tooltip content
		tooltip.innerHTML = `
			<h5>Modifier la variable: ${variable}</h5>
			<input type="text" value="${currentValue.replace(/"/g, '&quot;')}" placeholder="Nouvelle valeur" />
			<div class="tooltip-buttons">
				<button class="cancel">Annuler</button>
				<button class="primary save">Enregistrer</button>
			</div>
		`;
		
		// Position the tooltip
		const rect = element.getBoundingClientRect();
		tooltip.style.left = `${rect.left}px`;
		tooltip.style.top = `${rect.bottom + 5}px`;
		
		// Add event handlers
		const inputEl = tooltip.querySelector('input');
		const cancelBtn = tooltip.querySelector('button.cancel');
		const saveBtn = tooltip.querySelector('button.primary');
		
		if (inputEl && cancelBtn && saveBtn) {
			// Focus the input
			setTimeout(() => {
				(inputEl as HTMLInputElement).focus();
				(inputEl as HTMLInputElement).select();
			}, 10);
			
			// Cancel button closes the tooltip
			cancelBtn.addEventListener('click', () => {
				this.closeActiveTooltip();
			});
			
			// Save button updates the variable and closes tooltip
			saveBtn.addEventListener('click', () => {
				const newValue = (inputEl as HTMLInputElement).value;
				this.updateVariableValue(variable, newValue);
				this.closeActiveTooltip();
			});
			
			// Enter key also saves
			inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					const newValue = (inputEl as HTMLInputElement).value;
					this.updateVariableValue(variable, newValue);
					this.closeActiveTooltip();
				} else if (e.key === 'Escape') {
					this.closeActiveTooltip();
				}
			});
			
			// Click outside closes tooltip
			document.addEventListener('click', this.handleClickOutside);
		}
		
		// Add to DOM
		document.body.appendChild(tooltip);
		this.activeTooltip = tooltip;
	}
	
	// Handle clicks outside the tooltip to close it
	handleClickOutside = (e: MouseEvent) => {
		if (this.activeTooltip && e.target) {
			if (!this.activeTooltip.contains(e.target as Node)) {
				this.closeActiveTooltip();
			}
		}
	}
	
	// Close the active tooltip
	closeActiveTooltip() {
		if (this.activeTooltip) {
			document.removeEventListener('click', this.handleClickOutside);
			this.activeTooltip.remove();
			this.activeTooltip = null;
		}
	}
	
	// Update a variable value and refresh all instances
	updateVariableValue(variable: string, newValue: string) {
		// Here you would update the variable in your data model
		// This is a simplified example - you'll need to implement how 
		// to actually update your variable storage
		
		// Temporary implementation that just stores the value in the property map
		// Dans une version réelle, vous devrez mettre à jour la valeur dans le fichier frontmatter
		this.vaultProperties.temporaryUpdateVariable(variable, newValue);
		
		// Notify the user
		new Notice(`Variable ${variable} mise à jour`);
		
		// Refresh all views to show the new value
		this.app.workspace.iterateRootLeaves(leaf => {
			if (leaf.view instanceof MarkdownView && leaf.view.file) {
				this.refreshView(leaf.view.file);
			}
		});
	}
	
	modifyCodeBlockCopyButtons(element: HTMLElement) {
		// Find all code blocks with copy buttons in the given element
		const preElements = element.querySelectorAll('pre');
		
		preElements.forEach((preEl) => {
			// Find the copy button within this pre element
			const copyButton = preEl.querySelector('.copy-code-button');
			if (!copyButton) return;
			
			// Find the code element
			const codeEl = preEl.querySelector('code');
			if (!codeEl) return;
			
			// Create a static property on the element to store parsed text
			// This helps us avoid re-parsing on each click
			if (!codeEl.hasAttribute('data-processed-text')) {
				// Store the original text on first setup
				const originalText = codeEl.textContent || '';
				codeEl.setAttribute('data-original-text', originalText);
				
				// Process the text to remove line numbers
				let processedText = this.processCodeText(originalText);
				
				// If the code block has variables, process them separately
				const variables = codeEl.getAttribute('data-variables');
				const originalCode = codeEl.getAttribute('data-original-code');
				
				if (originalCode && variables) {
					// This is a managed variable block, process it
					let variableProcessed = originalCode;
					const variableArray = JSON.parse(variables);
					
					if (variableArray.length > 0) {
						const startDelimiter = this.settings.variableDelimiters.start;
						const endDelimiter = this.settings.variableDelimiters.end;
						
						variableArray.forEach((variable: string) => {
							const value = this.vaultProperties.getProperty(variable);
							if (value !== undefined) {
								const stringValue = this.stringifyValue(value);
								variableProcessed = variableProcessed.replace(
									new RegExp(`${startDelimiter}${variable}${endDelimiter}`, 'g'),
									stringValue
								);
							}
						});
					}
					
					// Also remove any line numbers from this processed version
					processedText = this.processCodeText(variableProcessed);
				}
				
				// Store the processed text for copy operations
				codeEl.setAttribute('data-processed-text', processedText);
			}
			
			// Override the click event
			copyButton.removeEventListener('click', this.getOriginalClickHandler(copyButton));
			
			copyButton.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				
				// Get the processed text (already has variables replaced and line numbers removed)
				let renderedText = codeEl.getAttribute('data-processed-text') || codeEl.textContent || '';
				
				// Copy the rendered text to clipboard
				navigator.clipboard.writeText(renderedText)
					.then(() => {
						// Don't show a notice for successful copy - it's what users expect
					})
					.catch(error => {
						console.error('Failed to copy text: ', error);
						new Notice('Failed to copy text');
					});
			});
		});
	}
	
	// Helper method to process code text and remove line numbers
	processCodeText(text: string): string {
		// Split the text into lines
		const lines = text.split('\n');
		
		// First check for the specific case reported by the user
		// Example: "1ssh test3@192.168.1.1 -p 222echo "test3""
		const fixedLines = lines.map(line => {
			// Case 1: Number at start followed directly by text (no space)
			// Example: "1ssh" → "ssh"
			let processed = line.replace(/^(\d+)([a-zA-Z])/, '$2');
			
			// If line doesn't seem to be formatted properly, check if it's a merged line with multiple commands
			// For example: "1ssh user@host -p portecho "text""
			if (processed.match(/\d+[a-zA-Z]/)) {
				// Try to find places where numbers appear in the middle of text without spaces
				// This could be a merged line where line numbers got mixed with content
				processed = processed.replace(/(\d+)([a-zA-Z])/g, ' $2');
			}
			
			return processed;
		});
		
		// Rebuild the text
		let processedText = fixedLines.join('\n');
		
		// As a final cleanup, ensure there are no random digit sequences at line starts
		processedText = processedText.replace(/^\d+\s+/gm, '');
		
		return processedText;
	}

	getOriginalClickHandler(element: Element): EventListener {
		// This is a placeholder - the original handler can't be directly accessed
		// But we can remove all click listeners and add our own
		return () => {}; 
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
			
			// Also update the copy buttons
			this.modifyCodeBlockCopyButtons(view.contentEl);
		}
	}

	updateCodeBlocksWithVariables(view: MarkdownView) {
		// Update code blocks
		const codeBlocks = view.contentEl.querySelectorAll('pre code');
		codeBlocks.forEach((codeBlock) => {
			const originalCode = codeBlock.getAttribute('data-original-code');
			if (originalCode) {
				const variables = JSON.parse(codeBlock.getAttribute('data-variables') || '[]');
				if (variables.length > 0) {
					// First, get all the variable values for replacement
					const startDelimiter = this.settings.variableDelimiters.start;
					const endDelimiter = this.settings.variableDelimiters.end;
					
					// Create a deep clone of the original code to work with
					let processedCode = originalCode;
					
					// Safely escape special regex characters
					const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const startDelimiterEscaped = escapeRegExp(startDelimiter);
					const endDelimiterEscaped = escapeRegExp(endDelimiter);
					
					// Create a regex that matches all variable patterns
					const variablePattern = `${startDelimiterEscaped}(${variables.join('|')})${endDelimiterEscaped}`;
					const regex = new RegExp(variablePattern, 'g');
					
					// Replace all matches in a single pass
					processedCode = processedCode.replace(regex, (match, variable) => {
						const value = this.vaultProperties.getProperty(variable);
						if (value !== undefined) {
							const stringValue = this.stringifyValue(value);
							return this.settings.highlightDynamicVariables
								? `<span class="dynamic-variable" data-variable="${variable}">${stringValue}</span>`
								: stringValue;
						}
						return match;
					});
					
					// Set the HTML directly
					codeBlock.innerHTML = processedCode;
					
					// Add click handlers to the newly created variable spans
					this.setupVariableEditHandlers(codeBlock as HTMLElement);
				}
			}
		});

		// Update all spans with variables
		const spans = view.contentEl.querySelectorAll('span[query]');
		spans.forEach((span) => {
			const query = span.getAttribute('query');
			if (query) {
				const value = tryComputeValueFromQuery(query, this.vaultProperties, this.settings);
				if (value !== undefined) {
					const stringValue = this.stringifyValue(value);
					
					// Extract the variable name from the query if possible
					let variableName = "";
					if (query.startsWith('get(') && query.endsWith(')')) {
						variableName = query.substring(4, query.length - 1);
					}
					
					const displayValue = this.settings.highlightDynamicVariables 
						? `<span class="dynamic-variable" data-variable="${variableName}">${stringValue}</span>`
						: stringValue;
					span.innerHTML = displayValue;
				}
			}
		});
		
		// Add click handlers to variable spans in the view
		this.setupVariableEditHandlers(view.contentEl);
		
		// After updating variables, also update the copy buttons
		this.modifyCodeBlockCopyButtons(view.contentEl);
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
					// First, get all the variable values for replacement
					const startDelimiter = this.settings.variableDelimiters.start;
					const endDelimiter = this.settings.variableDelimiters.end;
					
					// Create a deep clone of the original code to work with
					let processedCode = originalCode;
					
					// Safely escape special regex characters
					const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const startDelimiterEscaped = escapeRegExp(startDelimiter);
					const endDelimiterEscaped = escapeRegExp(endDelimiter);
					
					// Create a regex that matches all variable patterns
					const variablePattern = `${startDelimiterEscaped}(${variables.join('|')})${endDelimiterEscaped}`;
					const regex = new RegExp(variablePattern, 'g');
					
					// Replace all matches in a single pass
					processedCode = processedCode.replace(regex, (match, variable) => {
						const value = this.vaultProperties.getProperty(variable);
						if (value !== undefined) {
							const stringValue = this.stringifyValue(value);
							return this.settings.highlightDynamicVariables
								? `<span class="dynamic-variable" data-variable="${variable}">${stringValue}</span>`
								: stringValue;
						}
						return match;
					});
					
					// Set the HTML directly
					codeBlock.innerHTML = processedCode;
					
					// Add click handlers to the newly created variable spans
					this.setupVariableEditHandlers(codeBlock as HTMLElement);
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

	onunload() {
		// Clean up any custom styles on unload
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = null;
		}
		
		// Close any open tooltips
		this.closeActiveTooltip();
	}

	// Helper method to add stylesheet
	private addStylesheet(css: string) {
		// Create the style element
		const styleEl = document.createElement('style');
		styleEl.textContent = css;
		document.head.appendChild(styleEl);
		this.styleElement = styleEl;
	}

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
