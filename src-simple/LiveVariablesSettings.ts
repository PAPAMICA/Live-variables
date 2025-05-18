export interface LiveVariablesSettings {
	variableDelimiters: {
		start: string;
		end: string;
	};
	highlightDynamicVariables: boolean;
	dynamicVariableColor: string;
	language: 'en' | 'fr';
}

export const DEFAULT_SETTINGS: LiveVariablesSettings = {
	variableDelimiters: {
		start: '{{',
		end: '}}',
	},
	highlightDynamicVariables: true,
	dynamicVariableColor: '#ff9500',
	language: 'en'
}; 