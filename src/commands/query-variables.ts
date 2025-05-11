import { Editor, MarkdownView, Notice } from 'obsidian';
import QueryModal from 'src/QueryModal';
import { getNewLinesFromHtmlEscaping, htmlEscapeNewLine } from 'src/utils';
import { unescape } from 'he';
import LiveVariables from 'src/main';

const queryVariablesCommand = (plugin: LiveVariables) => ({
	id: 'query-variables',
	name: 'Query variables',
	editorCallback: (editor: Editor, view: MarkdownView) => {
		const re = new RegExp(
			String.raw`<span query="([\s\S]+?)"><\/span>`,
			'g'
		);
		const editorPosition = editor.getCursor();
		const lines = editor.getValue().split('\n');
		let query = '';
		let refStartLine = 0;
		let refEndLine = 0;
		let refStartCh = 0;
		let refEndCh = 0;

		// Traverse lines above the cursor to find the opening backticks
		for (let i = editorPosition.line; i >= 0; i--) {
			if (
				i !== editorPosition.line &&
				lines[i].contains('<span type="end"></span>')
			) {
				break;
			}
			const match = re.exec(lines[i]);
			if (match) {
				query = getNewLinesFromHtmlEscaping(match[1]);
				refStartLine = i;
				// Get start position of match[1]
				refStartCh = match.index;
				break;
			}
		}

		const refEndRE = new RegExp(String.raw`<span type="end"><\/span>`, 'g');
		// Traverse lines bellow to search for the end of the reference
		for (let i = editorPosition.line; i < editor.lineCount(); i++) {
			const match = refEndRE.exec(lines[i]);
			if (match) {
				refEndLine = i;
				refEndCh = match.index + match[0].length;
				break;
			}
		}

		new QueryModal(
			plugin.app,
			view,
			plugin,
			plugin.vaultProperties,
			query,
			(query, value, edit) => {
				if (edit) {
					editor.setSelection(
						{ line: refStartLine, ch: refStartCh },
						{ line: refEndLine, ch: refEndCh }
					);
				}
				editor.replaceSelection(
					`<span query="${htmlEscapeNewLine(
						query
					)}"></span>${unescape(value)}<span type="end"></span>\n`
				);
				new Notice(`Query ${edit ? 'Updated' : 'Inserted'}`);
			}
		).open();
	},
});

export default queryVariablesCommand;