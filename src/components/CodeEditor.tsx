import React from 'react';
import { ViewUpdate } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';

interface CodeEditorProps {
	value: string;
	onChange?: (value: string, viewUpdate: ViewUpdate) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange }) => {
	return (
		<CodeMirror
			theme="dark"
			value={value}
			basicSetup
			onChange={onChange}
		/>
	);
};

export default CodeEditor;
