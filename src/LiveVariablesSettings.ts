import { CustomFunction } from './types';

export interface LiveVariablesSettings {
	variableDelimiters: {
		start: string;
		end: string;
	};
	highlightText: boolean;
	highlightDynamicVariables: boolean;
	customFunctions: CustomFunction[];
}

export const DEFAULT_SETTINGS: LiveVariablesSettings = {
	variableDelimiters: {
		start: '{{',
		end: '}}',
	},
	highlightText: false,
	highlightDynamicVariables: true,
	customFunctions: [],
}; 