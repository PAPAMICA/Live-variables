import { MarkdownView, Notice, Plugin, TFile, Modal, App } from 'obsidian';
import { DEFAULT_SETTINGS, LiveVariablesSettings } from './LiveVariablesSettings';
import { LiveVariablesSettingTab } from './LiveVariablesSettingTab';
import VaultProperties from './VaultProperties';
import { getTranslations } from './i18n';

export default class LiveVariables extends Plugin {
	public settings: LiveVariablesSettings;
	public vaultProperties: VaultProperties;
	private styleElement: HTMLStyleElement | null = null;
	private activeTooltip: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.vaultProperties = new VaultProperties(this.app);

		// Add command to insert a variable
		this.addCommand({
			id: 'insert-variable',
			name: getTranslations(this.settings.language).commands.insertVariable,
			editorCallback: (editor, view) => {
				if (!view) return;
				
				// Get all available variables
				const variables: {key: string, value: any}[] = [];
				
				// Variables from current file
				const currentFile = view.file;
				if (currentFile) {
					const frontmatter = this.app.metadataCache.getFileCache(currentFile)?.frontmatter;
					if (frontmatter) {
						Object.keys(frontmatter).forEach(key => {
							variables.push({
								key: key,
								value: frontmatter[key]
							});
						});
					}
				}
				
				// If no variables are available
				const t = getTranslations(this.settings.language);
				if (variables.length === 0) {
					new Notice(t.ui.noVariables);
					return;
				}
				
				// Create the selection modal
				const modal = new VariableSelectionModal(
					this.app, 
					variables, 
					(variable) => {
						const variableText = `${this.settings.variableDelimiters.start}${variable.key}${this.settings.variableDelimiters.end}`;
						editor.replaceSelection(variableText);
					},
					this.settings.language
				);
				
				modal.open();
			}
		});

		this.addSettingTab(new LiveVariablesSettingTab(this.app, this));
		
		// Add CSS styles for variable highlighting
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

		// Register markdown post processor to replace variables in preview mode
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

		// Register event handlers
		this.registerEvents();
	}
	
	// Register all event handlers
	private registerEvents() {
		// File change event
		this.registerEvent(
			this.app.vault.on('modify', (file: TFile) => {
				// Update vault properties immediately
				this.vaultProperties.updateProperties(file);
				
				// Refresh the active view if it's the modified file
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view && view.file === file) {
					if (view.getMode() === 'preview') {
						view.previewMode.rerender();
					} else {
						view.editor.refresh();
					}
					
					this.app.workspace.trigger('resize');
				}
			})
		);

		// Layout change event
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.app.workspace.iterateRootLeaves((leaf) => {
					if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
						this.modifyCodeBlockCopyButtons(leaf.view.containerEl);
					}
				});
			})
		);
		
		// Active leaf change event
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf?.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
					setTimeout(() => {
						this.modifyCodeBlockCopyButtons(leaf.view.containerEl);
					}, 100);
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
				
				const variable = varEl.getAttribute('data-variable');
				if (!variable) return;
				
				const currentValue = this.vaultProperties.getProperty(variable) || '';
				
				this.showVariableEditTooltip(varEl as HTMLElement, variable, currentValue.toString());
			});
		});
	}
	
	// Create and show the variable edit tooltip
	showVariableEditTooltip(element: HTMLElement, variable: string, currentValue: string) {
		// Close any existing tooltip
		this.closeActiveTooltip();
		
		const t = getTranslations(this.settings.language);
		
		// Create tooltip
		const tooltip = document.createElement('div');
		tooltip.className = 'variable-edit-tooltip';
		
		// Create tooltip content
		tooltip.innerHTML = `
			<h5>${t.ui.editVariable}: ${variable}</h5>
			<input type="text" value="${currentValue.replace(/"/g, '&quot;')}" placeholder="${t.ui.newValue}" />
			<div class="tooltip-buttons">
				<button class="cancel">${t.ui.cancel}</button>
				<button class="primary save">${t.ui.save}</button>
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
			saveBtn.addEventListener('click', async () => {
				const newValue = (inputEl as HTMLInputElement).value;
				await this.updateVariableValue(variable, newValue);
				this.closeActiveTooltip();
			});
			
			// Enter key also saves
			inputEl.addEventListener('keydown', async (e) => {
				if (e.key === 'Enter') {
					const newValue = (inputEl as HTMLInputElement).value;
					await this.updateVariableValue(variable, newValue);
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
		if (this.activeTooltip && e.target && !this.activeTooltip.contains(e.target as Node)) {
			this.closeActiveTooltip();
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
	async updateVariableValue(variable: string, newValue: string) {
		const t = getTranslations(this.settings.language);
		try {
			// Update the variable (temporary and permanent)
			await this.vaultProperties.temporaryUpdateVariable(variable, newValue);
			
			// Notify the user
			new Notice(`${t.ui.variableUpdated}: "${variable}"`);
			
			// Force refresh of the active view
			const activeLeaf = this.app.workspace.activeLeaf;
			if (activeLeaf?.view instanceof MarkdownView && activeLeaf.view.file) {
				this.refreshView(activeLeaf.view.file);
				
				// Force a complete rebuild of the DOM for displayed variables
				setTimeout(() => {
					if (activeLeaf.view instanceof MarkdownView) {
						const view = activeLeaf.view;
						
						if (view.getMode() === 'preview') {
							view.previewMode.rerender(true);
							
							// Wait for DOM to update then reapply changes
							setTimeout(() => {
								this.updateCodeBlocksWithVariables(view);
								this.setupVariableEditHandlers(view.containerEl);
								this.modifyCodeBlockCopyButtons(view.containerEl);
							}, 100);
						}
						
						this.app.workspace.trigger('live-variables:variable-updated', variable, newValue);
					}
				}, 50);
			}
			
			// Also refresh all other views that might use this variable
			this.app.workspace.iterateRootLeaves(leaf => {
				if (leaf !== this.app.workspace.activeLeaf && 
					leaf.view instanceof MarkdownView && 
					leaf.view.file) {
					this.refreshView(leaf.view.file);
				}
			});
			
			// Force a global refresh after a short delay
			setTimeout(() => {
				this.forceGlobalRefresh();
			}, 200);
		} catch (error) {
			console.error(`${t.ui.updateError}:`, error);
			new Notice(`${t.ui.updateError}: ${error.message}`);
		}
	}
	
	// Force a global refresh of all views
	forceGlobalRefresh() {
		// Force a resize, which often triggers a reflow
		this.app.workspace.trigger('resize');
		
		// Force a recalculation of vault properties
		this.vaultProperties.updateVaultProperties();
		
		// Refresh all markdown views
		this.app.workspace.iterateAllLeaves(leaf => {
			if (leaf.view instanceof MarkdownView) {
				if (leaf.view.getMode() === 'preview') {
					leaf.view.previewMode.rerender(true);
				} else {
					leaf.view.editor.refresh();
				}
			}
		});
	}
	
	// Refresh a specific view
	refreshView(file: TFile) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file === file) {
			this.vaultProperties.updateProperties(file);

			if (view.getMode() === 'preview') {
				view.previewMode.rerender(true);
				
				setTimeout(() => {
					this.updateCodeBlocksWithVariables(view);
					this.setupVariableEditHandlers(view.contentEl);
					this.modifyCodeBlockCopyButtons(view.contentEl);
					this.app.workspace.trigger('resize');
				}, 100);
			} else {
				view.editor.refresh();
				this.app.workspace.trigger('resize');
			}
		} else {
			// If the active view is not the requested file,
			// search all leaves to find the right view
			let foundView = false;
			this.app.workspace.iterateAllLeaves(leaf => {
				if (!foundView && leaf.view instanceof MarkdownView && leaf.view.file === file) {
					foundView = true;
					this.vaultProperties.updateProperties(file);
					
					if (leaf.view.getMode() === 'preview') {
						leaf.view.previewMode.rerender(true);
						
						setTimeout(() => {
							this.updateCodeBlocksWithVariables(leaf.view as MarkdownView);
							
							if (leaf.view instanceof MarkdownView) {
								this.setupVariableEditHandlers(leaf.view.containerEl);
								this.modifyCodeBlockCopyButtons(leaf.view.containerEl);
							}
						}, 100);
					} else {
						leaf.view.editor.refresh();
					}
				}
			});
		}
	}

	// Update code blocks with variables
	updateCodeBlocksWithVariables(view: MarkdownView) {
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
	}

	// Convert any value to string
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
	
	// Override copy buttons in code blocks to copy variable values
	modifyCodeBlockCopyButtons(element: HTMLElement) {
		const preElements = element.querySelectorAll('pre');
		
		preElements.forEach((preEl) => {
			const copyButton = preEl.querySelector('.copy-code-button');
			if (!copyButton) return;
			
			const codeEl = preEl.querySelector('code');
			if (!codeEl) return;
			
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
	
	// Helper method to get original click handler (placeholder)
	getOriginalClickHandler(element: Element): EventListener {
		// This is a placeholder - the original handler can't be directly accessed
		return () => {}; 
	}

	// Clean up on plugin unload
	onunload() {
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = null;
		}
		
		this.closeActiveTooltip();
	}

	// Helper method to add stylesheet
	private addStylesheet(css: string) {
		const styleEl = document.createElement('style');
		styleEl.textContent = css;
		document.head.appendChild(styleEl);
		this.styleElement = styleEl;
	}

	// Load settings from storage
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	// Save settings to storage
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// Modal for variable selection
class VariableSelectionModal extends Modal {
	private variables: {key: string, value: any}[];
	private onChoose: (variable: {key: string, value: any}) => void;
	private language: 'en' | 'fr';
	private searchInput: HTMLInputElement;
	private variableList: HTMLElement;
	private displayedVariables: {key: string, value: any}[];
	
	constructor(
		app: App, 
		variables: {key: string, value: any}[], 
		onChoose: (variable: {key: string, value: any}) => void,
		language: 'en' | 'fr'
	) {
		super(app);
		this.variables = variables;
		this.displayedVariables = [...variables]; // Clone the array
		this.onChoose = onChoose;
		this.language = language;
	}
	
	onOpen() {
		const {contentEl} = this;
		const t = getTranslations(this.language);
		
		contentEl.createEl('h2', {text: t.ui.selectVariable});
		
		// Create search input
		const searchContainer = contentEl.createEl('div', {cls: 'search-container'});
		searchContainer.style.margin = '10px 0';
		
		this.searchInput = searchContainer.createEl('input', {
			cls: 'search-input',
			attr: {
				type: 'text',
				placeholder: t.ui.searchVariable
			}
		});
		
		// Style the search input
		this.searchInput.style.width = '100%';
		this.searchInput.style.padding = '8px';
		this.searchInput.style.borderRadius = '4px';
		this.searchInput.style.border = '1px solid var(--background-modifier-border)';
		this.searchInput.style.backgroundColor = 'var(--background-primary)';
		this.searchInput.style.color = 'var(--text-normal)';
		
		// Focus the search input when the modal opens
		setTimeout(() => this.searchInput.focus(), 10);
		
		// Create a list of variables
		this.variableList = contentEl.createEl('div', {cls: 'variable-list'});
		
		// Style the list
		this.variableList.style.maxHeight = '60vh';
		this.variableList.style.overflowY = 'auto';
		this.variableList.style.marginTop = '10px';
		
		// Add search functionality
		this.searchInput.addEventListener('input', () => {
			this.filterVariables(this.searchInput.value);
		});
		
		// Add keyboard navigation for the search input
		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				// Insert the first visible variable when pressing Enter
				if (this.displayedVariables.length > 0) {
					e.preventDefault(); // Prevent default form submission behavior
					this.onChoose(this.displayedVariables[0]);
					this.close();
				}
			} else if (e.key === 'Escape') {
				// Close the modal when pressing Escape
				e.preventDefault(); // Prevent default behavior
				this.close();
			} else if (e.key === 'ArrowDown') {
				// Move focus to the first variable item
				const firstItem = this.variableList.querySelector('.variable-item');
				if (firstItem) {
					e.preventDefault(); // Prevent scrolling
					(firstItem as HTMLElement).focus();
				}
			}
		});
		
		// Render the initial list
		this.renderVariableList();
	}
	
	filterVariables(query: string) {
		// Reset the displayed variables if query is empty
		if (!query) {
			this.displayedVariables = [...this.variables];
		} else {
			const lowerQuery = query.toLowerCase();
			this.displayedVariables = this.variables.filter(variable => 
				variable.key.toLowerCase().includes(lowerQuery) || 
				String(variable.value).toLowerCase().includes(lowerQuery)
			);
		}
		
		// Re-render the list with the filtered variables
		this.renderVariableList();
	}
	
	renderVariableList() {
		// Clear the current list
		this.variableList.empty();
		
		// Check if we have any matching variables
		if (this.displayedVariables.length === 0) {
			const t = getTranslations(this.language);
			this.variableList.createEl('div', {
				cls: 'no-results',
				text: t.ui.noVariables
			}).style.padding = '8px';
			return;
		}
		
		// Add each variable as a clickable item
		this.displayedVariables.forEach((variable, index) => {
			const varItem = this.variableList.createEl('div', {
				cls: 'variable-item',
				text: `${variable.key}: ${this.formatValue(variable.value)}`
			});
			
			// Style the item
			varItem.style.padding = '8px';
			varItem.style.margin = '4px 0';
			varItem.style.borderRadius = '4px';
			varItem.style.cursor = 'pointer';
			varItem.style.backgroundColor = 'var(--background-secondary)';
			varItem.style.outline = 'none'; // Remove default outline
			
			// Make item focusable and set data attribute for identification
			varItem.tabIndex = 0;
			varItem.setAttribute('data-index', index.toString());
			
			// Add keyboard support with extra styling on focus
			varItem.addEventListener('focus', () => {
				varItem.style.backgroundColor = 'var(--background-modifier-hover)';
				varItem.style.boxShadow = '0 0 0 2px var(--interactive-accent)';
			});
			
			varItem.addEventListener('blur', () => {
				varItem.style.backgroundColor = 'var(--background-secondary)';
				varItem.style.boxShadow = 'none';
			});
			
			varItem.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					e.stopPropagation();
					this.onChoose(variable);
					this.close();
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					const nextSibling = varItem.nextElementSibling as HTMLElement;
					if (nextSibling && nextSibling.classList.contains('variable-item')) {
						nextSibling.focus();
					}
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					const prevSibling = varItem.previousElementSibling as HTMLElement;
					if (prevSibling && prevSibling.classList.contains('variable-item')) {
						prevSibling.focus();
					} else {
						this.searchInput.focus();
					}
				} else if (e.key === 'Escape') {
					e.preventDefault();
					this.close();
				}
			});
			
			// Hover effect
			varItem.addEventListener('mouseenter', () => {
				varItem.style.backgroundColor = 'var(--background-modifier-hover)';
			});
			
			varItem.addEventListener('mouseleave', () => {
				if (document.activeElement !== varItem) {
					varItem.style.backgroundColor = 'var(--background-secondary)';
				}
			});
			
			// On click, insert the variable
			varItem.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.onChoose(variable);
				this.close();
			});
		});
	}
	
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
	
	formatValue(value: any): string {
		if (value === null || value === undefined) return 'null';
		if (typeof value === 'object') {
			try {
				return JSON.stringify(value).substring(0, 30) + (JSON.stringify(value).length > 30 ? '...' : '');
			} catch {
				return String(value);
			}
		}
		const strValue = String(value);
		return strValue.length > 30 ? strValue.substring(0, 30) + '...' : strValue;
	}
}
