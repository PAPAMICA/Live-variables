import React from 'react';
import { DeleteFilled } from '@ant-design/icons';
import { ConfigProvider, Table, TableProps } from 'antd';
import { FC, useCallback, useEffect, useState } from 'react';
import { CustomFunction } from '../types';
import LiveVariable from 'src/main';
import CodeEditor from './CodeEditor';
import Setting from './obsidian-components/Setting';

interface LiveVariableReactSettingTabProps {
	plugin: LiveVariable;
}

const LiveVariablesReactSettingTab: FC<LiveVariableReactSettingTabProps> = ({
	plugin,
}) => {
	const [customFunctions, setCustomFunctions] = useState<CustomFunction[]>(
		[]
	);

	const [hightlightText, setHighlightText] = useState<boolean>();
	const [highlightDynamicVariables, setHighlightDynamicVariables] = useState<boolean>();
	const [dynamicVariableColor, setDynamicVariableColor] = useState<string>('#ff0000');
	const [enableInlineEditing, setEnableInlineEditing] = useState<boolean>(true);
	const [variableDelimiters, setVariableDelimiters] = useState<{
		start: string;
		end: string;
	}>({
		start: '{{',
		end: '}}'
	});

	const columns: TableProps<CustomFunction>['columns'] = [
		{
			title: 'Function Name',
			dataIndex: 'name',
			key: 'name',
		},
		{
			title: 'Function Code',
			dataIndex: 'code',
			key: 'code',
			width: 50,
			render: (code, record) => (
				<CodeEditor
					value={code}
					onChange={(val) => {
						const previousValue = record;
						const newValue = { ...record, code: val };
						updateFunction(previousValue, newValue);
					}}
				/>
			),
		},
		{
			title: 'Action',
			fixed: 'right',
			dataIndex: '',
			key: 'x',
			render: (_, record) => (
				<DeleteFilled onClick={() => deleteFunction(record)} />
			),
		},
	];

	const deleteFunction = (customFunction: CustomFunction) => {
		plugin.settings.customFunctions.remove(customFunction);
		plugin.saveSettings();
	};

	const updateFunction = (
		previousValue: CustomFunction,
		newValue: CustomFunction
	) => {
		const index = plugin.settings.customFunctions.indexOf(previousValue);
		plugin.settings.customFunctions[index] = newValue;
		plugin.saveSettings();
	};

	const updateHighlightText = (newValue: boolean) => {
		setHighlightText(newValue);
		plugin.settings.highlightText = newValue;
		plugin.saveSettings();
	};

	const updateHighlightDynamicVariables = (newValue: boolean) => {
		setHighlightDynamicVariables(newValue);
		plugin.settings.highlightDynamicVariables = newValue;
		plugin.saveSettings();
	};

	const updateDynamicVariableColor = (newValue: string) => {
		setDynamicVariableColor(newValue);
		plugin.settings.dynamicVariableColor = newValue;
		plugin.saveSettings();
	};

	const updateEnableInlineEditing = (newValue: boolean) => {
		setEnableInlineEditing(newValue);
		plugin.settings.enableInlineEditing = newValue;
		plugin.saveSettings();
	};

	const updateVariableDelimiters = (newValue: { start: string; end: string }) => {
		setVariableDelimiters(newValue);
		plugin.settings.variableDelimiters = newValue;
		plugin.saveSettings();
	};

	const loadDataSource = useCallback(async () => {
		await plugin.loadSettings();
		setCustomFunctions(plugin.settings.customFunctions);
		setHighlightText(plugin.settings.highlightText);
		setHighlightDynamicVariables(plugin.settings.highlightDynamicVariables);
		setDynamicVariableColor(plugin.settings.dynamicVariableColor);
		setVariableDelimiters(plugin.settings.variableDelimiters);
		setEnableInlineEditing(plugin.settings.enableInlineEditing);
	}, [deleteFunction, updateFunction]);

	useEffect(() => {
		loadDataSource();
	}, [deleteFunction, updateFunction]);

	return (
		<ConfigProvider>
			<div style={{ display: 'flex', flexDirection: 'column' }}>
				<Setting heading name="Live Variables" />
				<Setting
					className="setting-item"
					name="Highlight Text"
					desc="Highlight text in the editor"
				>
					<Setting.Toggle
						checked={hightlightText}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHighlightText(e.target.checked)}
					/>
				</Setting>
				<Setting
					className="setting-item"
					name="Highlight Dynamic Variables"
					desc="Highlight variables that are dynamically updated"
				>
					<Setting.Toggle
						checked={highlightDynamicVariables}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHighlightDynamicVariables(e.target.checked)}
					/>
				</Setting>
				<Setting
					className="setting-item"
					name="Dynamic Variable Color"
					desc="Choose the color for dynamically updated variables"
				>
					<input
						type="color"
						value={dynamicVariableColor}
						onChange={(e) => updateDynamicVariableColor(e.target.value)}
						style={{ width: '50px', height: '25px' }}
					/>
				</Setting>
				<Setting
					className="setting-item"
					name="Enable Inline Editing"
					desc="Allow editing variables directly in the content using [{{-var-}}] syntax"
				>
					<Setting.Toggle
						checked={enableInlineEditing}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEnableInlineEditing(e.target.checked)}
					/>
				</Setting>
				<Setting
					className="setting-item"
					name="Variable Delimiters"
					desc="Set the delimiters for variables in code blocks"
				>
					<div style={{ display: 'flex', gap: '10px' }}>
						<Setting.Text
							value={variableDelimiters.start}
							placeHolder="Start delimiter"
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
								updateVariableDelimiters({
									...variableDelimiters,
									start: e.target.value
								});
							}}
						/>
						<Setting.Text
							value={variableDelimiters.end}
							placeHolder="End delimiter"
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
								updateVariableDelimiters({
									...variableDelimiters,
									end: e.target.value
								});
							}}
						/>
					</div>
				</Setting>
				<div className="setting-item-info" style={{ marginTop: 10 }}>
					<div className="setting-item-name">Custom JS Functions</div>
					<div className="setting-item-description">
						Saved custom JS functions
					</div>
				</div>
				<Table
					pagination={false}
					style={{ margin: 10 }}
					columns={columns}
					dataSource={customFunctions}
				></Table>
			</div>
		</ConfigProvider>
	);
};

export default LiveVariablesReactSettingTab;
