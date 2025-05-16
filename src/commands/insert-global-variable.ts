import { Editor, MarkdownView, Notice } from 'obsidian';
import LiveVariables from 'src/main';
import { PropertySelectionModal } from 'src/property-selection-modal';
import {
	addNewLineAtTheStartIfStartingWithMarkdown,
	highlightText,
} from 'src/utils';

const insertGlobalVariable = (plugin: LiveVariables) => ({
	id: 'insert-global-variable',
	name: 'Insert variable from another note',
	editorCallback: (editor: Editor, view: MarkdownView) => {
		new PropertySelectionModal(
			plugin.app,
			view,
			true,
			(property) => {
				editor.replaceSelection(
					`<span query="get(${property.key})"></span>${highlightText(
						addNewLineAtTheStartIfStartingWithMarkdown(
							property.value
						),
						plugin.settings
					)}<span type="end"></span>\n`
				);
				new Notice(`Variable ${property.key} inserted`);
			},
			plugin.vaultProperties
		).open();
	},
});

export default insertGlobalVariable;
