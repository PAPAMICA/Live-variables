import { LiveVariablesSettings } from 'src/LiveVariablesSettings';
import LiveVariable from 'src/main';
import { CustomFunction } from '../types';

export const saveFunction = (
	plugin: LiveVariable,
	functionName: string,
	functionCode: string
) => {
	const settings: LiveVariablesSettings = plugin.settings;
	if (
		settings.customFunctions
			.map((customFunctiom) => customFunctiom.name)
			.contains(functionName)
	) {
		return;
	}
	settings.customFunctions.push({
		name: functionName,
		code: functionCode,
	});
	plugin.saveData(settings);
};

export const createCustomFunction = (
	functionName: string,
	functionCode: string
): CustomFunction => {
	return {
		name: functionName,
		code: functionCode
	};
};
