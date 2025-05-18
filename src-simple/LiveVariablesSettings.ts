import { CustomFunction } from './types';

export interface LiveVariablesSettings {
	variableDelimiters: {
		start: string;
		end: string;
	};
	highlightDynamicVariables: boolean;
	dynamicVariableColor: string;
}

export const DEFAULT_SETTINGS: LiveVariablesSettings = {
	variableDelimiters: {
		start: '{{',
		end: '}}',
	},
	highlightDynamicVariables: true,
	dynamicVariableColor: '#ff9500',
}; 