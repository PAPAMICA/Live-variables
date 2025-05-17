import { CustomFunction } from './types';

export interface LiveVariablesSettings {
	highlightText: boolean;
	customFunctions: CustomFunction[];
	variableDelimiters: {
		start: string;
		end: string;
	};
}

export const DEFAULT_SETTINGS: LiveVariablesSettings = {
	highlightText: true,
	customFunctions: [],
	variableDelimiters: {
		start: '{{',
		end: '}}'
	}
}; 