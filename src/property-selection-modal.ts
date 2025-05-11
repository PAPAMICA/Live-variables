import { App, MarkdownView, SuggestModal } from 'obsidian';
import VaultProperties from './VaultProperties';
import { trancateString } from './utils';

export interface Property {
	key: string;
	value: string;
}

export class PropertySelectionModal extends SuggestModal<Property> {
	onSelect: (property: Property) => void;
	view: MarkdownView;
	global: boolean;
	vaultProperties: VaultProperties;

	constructor(
		app: App,
		view: MarkdownView,
		global: boolean,
		onSelect: (property: Property) => void,
		vaultProperties: VaultProperties
	) {
		super(app);
		this.view = view;
		this.global = global;
		this.onSelect = onSelect;
		this.vaultProperties = vaultProperties;
	}

	getSuggestions(query: string): Property[] {
		if (this.global) {
			return this.getGlobalSuggestions(query);
		}
		return this.getLocalSuggestions(query);
	}

	getLocalSuggestions(query: string): Property[] {
		if (this.view.file) {
			return this.vaultProperties.findLocalPropertiesWithPathContaining(
				this.view.file,
				query
			);
		}
		return [];
	}

	getGlobalSuggestions(query: string): Property[] {
		return this.vaultProperties.findPropertiesWithPathContaining(query);
	}

	renderSuggestion(property: Property, el: HTMLElement) {
		el.createEl('div', { text: property.key });
		el.createEl('small', {
			text: trancateString(property.value, 100),
		});
	}

	onChooseSuggestion(property: Property, evt: MouseEvent | KeyboardEvent) {
		this.onSelect(property);
	}
}
