import { Editor, MarkdownView, Notice } from 'obsidian';
import LiveVariables from 'src/main';
import { PropertySelectionModal } from 'src/property-selection-modal';
import { highlightText } from 'src/utils';

const insertLocalVariableCommand = (plugin: LiveVariables) => ({
    id: 'insert-local-variable',
    name: 'Insert local variable',
    editorCallback: (editor: Editor, view: MarkdownView) => {
        new PropertySelectionModal(
            plugin.app,
            view,
            false,
            (property) => {
                editor.replaceSelection(
                    `<span query="get(${
                        property.key
                    })"></span>${highlightText(
                        property.value,
                        plugin.settings
                    )}<span type="end"></span>\n`
                );
                new Notice(`Variable ${property.key} inserted`);
            },
            plugin.vaultProperties
        ).open();
    },
});

export default insertLocalVariableCommand;
