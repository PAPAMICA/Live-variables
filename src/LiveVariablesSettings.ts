import { CustomFunction } from './types';

export interface LiveVariablesSettings {
	variableDelimiters: {
		start: string;
		end: string;
	};
	highlightText: boolean;
	highlightDynamicVariables: boolean;
	dynamicVariableColor: string;
	customFunctions: CustomFunction[];
	enableInlineEditing: boolean;
}

export const DEFAULT_SETTINGS: LiveVariablesSettings = {
	variableDelimiters: {
		start: '{{',
		end: '}}',
	},
	highlightText: false,
	highlightDynamicVariables: true,
	dynamicVariableColor: '#ff0000',
	customFunctions: [],
	enableInlineEditing: true,
}; 