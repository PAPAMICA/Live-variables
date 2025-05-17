import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import CodeEditor from './CodeEditor';
import Setting from './obsidian-components/Setting';
import {
	copyToClipboard,
	firstNElement,
	getArgNames,
	minifyCode,
} from 'src/utils';
import { CloseOutlined, SaveFilled } from '@ant-design/icons';
import { saveFunction } from 'src/service/function';
import LiveVariable from 'src/main';
import { FuncOption, QueryError } from './QueryModalReactForm';
import { VarQuery } from 'src/VariableQueryParser';
import VaultProperties from 'src/VaultProperties';

const gptPrompt = `Please write me a lambda function in javascript that {{what should the function do}}, the format should be like : 
\`\`\`
	(a, b) => {
	return a + b;
	}
\`\`\``;

export interface JsFuncConfig {
	code: string;
	name: string;
	saveChecked: boolean;
	args: string[];
	error?: string;
}

export interface JsFuncRef {
	saveFunction: () => void;
}

interface QueryJsFuncProps {
	plugin: LiveVariable;
	vaultProperties: VaultProperties;
	onQueryUpdate: (query: string) => void;
	queryFuncOptions: Record<string, FuncOption>;
	queryFunc: string;
	initQuery?: VarQuery;
	queryError: {
		error: QueryError;
		onErrorUpdate: (queryError: QueryError) => void;
	};
}

export const QueryJsFunc = forwardRef<JsFuncRef, QueryJsFuncProps>(
	(
		{
			plugin,
			vaultProperties,
			onQueryUpdate,
			queryFuncOptions,
			queryFunc,
			initQuery,
			queryError,
		},
		ref
	) => {
		useImperativeHandle(ref, () => ({
			saveFunction() {
				if (saveChecked) {
					saveFunction(plugin, name, code);
				}
			},
		}));

		const [name, setName] = useState<string>('');
		const [code, setCode] = useState<string>(
			'(a, b) => {\n  return a + b;\n}'
		);
		const [args, setArgs] = useState<string[]>([]);
		const [error, setError] = useState<string>();
		const [saveChecked, setSaveChecked] = useState<boolean>(false);

		const editMode = initQuery !== undefined;

		const [vars, setVars] = useState<[string, string][]>([]);

		const updateVar = (index: number, [name, val]: string[]) => {
			const newVars = [...vars];
			newVars[index] = [name, val];
			setVars([...newVars]);
		};

		const addableArg = () => {
			const exactSize = args.length;
			return (exactSize || exactSize === 0) && exactSize > vars.length;
		};

		const removableArg = () => {
			const exactSize = args.length;
			return exactSize && exactSize < vars.length;
		};

		const valideArgs = () => {
			if (args.length === 0) {
				queryError.onErrorUpdate({
					...queryError.error,
					argsError: undefined,
				});
				return true;
			}
			if (vars.some((v) => v[1].length === 0)) {
				queryError.onErrorUpdate({
					...queryError.error,
					argsError: {
						message: `Arguments cannot be empty`,
						visible: queryError.error.argsError?.visible,
					},
				});
				return false;
			}
			if (vars.length === args.length) {
				return vars.every(valideArg);
			}
			return false;
		};

		const valideArg = ([name, val]: [string, string]): boolean => {
			if (vaultProperties.getProperty(val) === undefined) {
				queryError.onErrorUpdate({
					...queryError.error,
					argsError: {
						message: `variable ${val} not found`,
						visible: queryError.error.argsError?.visible,
					},
				});
				return false;
			}
			queryError.onErrorUpdate({
				...queryError.error,
				argsError: undefined,
			});
			return true;
		};

		const valideFunctionCode = () => {
			try {
				Function('return' + code);
				setError(undefined);
			} catch (err) {
				if (err instanceof Error) {
					setError(`Code error: ${err.message}`);
				} else {
					setError(`An unknown error occurred`);
				}
				return false;
			}
			return true;
		};

		const updateQuery = async () => {
			if (!valideArgs()) {
				return;
			}
			if (valideFunctionCode()) {
				const minimalFunctionCode = await minifyCode(code);
				const query = `jsFunc(${vars.map(
					(it) => it[1]
				)}, func = ${minimalFunctionCode})`;
				onQueryUpdate(query);
			}
		};

		const isSavedCustomFunction = () => {
			return queryFuncOptions[queryFunc].code ?? false;
		};

		const updateVarsSize = () => {
			const exactSize = args.length;
			const defaultValue = ['', ''];
			if (exactSize || exactSize === 0) {
				setVars(firstNElement(vars, exactSize, defaultValue));
			}
		};

		const loadSavedFunction = () => {
			if (isSavedCustomFunction() && queryFuncOptions[queryFunc].code) {
				setCode(queryFuncOptions[queryFunc].code || '');
				setName(queryFuncOptions[queryFunc].displayValue);
			}
		};

		const loadCurrentQuery = () => {
			if (initQuery) {
				const [funcCode, ...funcArgs] = initQuery.args;
				setCode(funcCode);
				const args = [...getArgNames(funcCode)];
				setArgs(args);
				setVars(
					args.map((argName, index) => [argName, funcArgs[index]])
				);
			}
		};

		useEffect(() => {
			loadSavedFunction();
		}, [queryFunc]);

		useEffect(() => {
			queryError.onErrorUpdate({
				...queryError,
				argsError: { ...queryError.error.argsError, visible: false },
			});
			updateQuery();
		}, [vars, code]);

		useEffect(() => {
			setArgs([...getArgNames(code)]);
			valideFunctionCode();
		}, [code]);

		useEffect(() => {
			updateVarsSize();
		}, [args]);

		useEffect(() => {
			if (editMode) {
				loadCurrentQuery();
			}
		}, [initQuery]);

		return (
			<>
				<div>
					<div className="sub-setting-item">
						<div className="setting-item-name sub-setting-item-name">
							Custom JS Function
						</div>
						<div className="code-editor-container">
							<CodeEditor
								value={code}
								onChange={(val) => {
									setCode(val);
								}}
							/>
						</div>
						{error && (
							<div className="setting-item-description query-modal-error">
								{error}
							</div>
						)}

						<div className="setting-item-description">
							Don't know how to code ? Here is a GPT prompt
							template for you{' '}
							<a
								onClick={() => {
									copyToClipboard(gptPrompt);
								}}
							>
								(click to copy)
							</a>
						</div>
					</div>
					<Setting
						className="sub-setting-item"
						name="Save Function"
						desc="Save function for re-use ?"
					>
						<Setting.Toggle
							onChange={() => {
								setSaveChecked(!saveChecked);
							}}
						/>
					</Setting>
					{saveChecked && (
						<Setting
							className="sub-setting-item"
							name="Function name"
							desc="Give it a name"
						>
							<Setting.Text
								placeHolder="Function name"
								onChange={(e) => {
									setName(e.target.value);
								}}
								value={name}
							/>
							<Setting.ExtraButton
								icon={<SaveFilled />}
								onClick={() => saveFunction(plugin, name, code)}
							/>
						</Setting>
					)}
				</div>
				{((!addableArg() && vars.length !== 0) || addableArg()) && (
					<Setting
						className="query-modal-setting-item"
						name={'Arguments'}
						desc={
							'Variable arguments to be passed to the function.'
						}
					>
						{addableArg() && (
							<Setting.Button
								onClick={(e) => {
									setVars([...vars, ['', '']]);
								}}
							>
								Add Argument
							</Setting.Button>
						)}
					</Setting>
				)}
				{vars.map(([name, val], index) => {
					return (
						<Setting
							className="sub-setting-item"
							key={index + 1}
							name={`Variable ${args[index]}`}
							desc={`preview value: ${vaultProperties.getPropertyPreview(
								val
							)}`}
						>
							<Setting.Search
								suggestions={vaultProperties.findPathsContaining(
									val
								)}
								placeHolder={`Enter argument ${index + 1}`}
								onChange={(value) => {
									updateVar(index, [name, value]);
								}}
								value={vars[index][1]}
							/>
							{removableArg() && (
								<Setting.ExtraButton
									icon={<CloseOutlined />}
									ariaLabel="Remove Argument"
									onClick={() => {
										const newVars = [...vars];
										newVars.splice(index, 1);
										setVars(newVars);
									}}
								/>
							)}
						</Setting>
					);
				})}
				{queryError.error.argsError &&
					queryError.error.argsError.visible && (
						<div className="setting-item-description query-modal-error">
							{queryError.error.argsError.message}
						</div>
					)}
			</>
		);
	}
);
