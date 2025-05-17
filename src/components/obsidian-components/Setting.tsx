import React from 'react';
import { Dropdown } from 'antd';

import {
	ChangeEventHandler,
	FC,
	MouseEventHandler,
	ReactNode,
	useEffect,
	useState,
} from 'react';

interface SettingProps {
	className?: string;
	name?: string;
	desc?: string;
	heading?: boolean;
	children?: React.ReactNode;
}

interface SettingTextProps {
	value?: string;
	placeHolder?: string;
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface SettingButtonProps {
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	cta?: boolean;
	children?: React.ReactNode;
}

interface SettingDropdownProps {
	options: Record<string, { displayValue: string; desc?: string }>;
	onChange?: React.ChangeEventHandler<HTMLSelectElement>;
	value?: string | number | readonly string[];
	disabled?: boolean;
}

interface SettingSearchProps {
	value?: string;
	placeHolder?: string;
	onChange?: (value: string) => void;
	suggestions?: string[];
}

interface SettingExtraButtonProps {
	icon?: React.ReactNode;
	onClick?: () => void;
	ariaLabel?: string;
}

interface SettingToggleProps {
	checked?: boolean;
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Setting: React.FC<SettingProps> & {
	Text: FC<SettingTextProps>;
	Button: FC<SettingButtonProps>;
	Dropdown: FC<SettingDropdownProps>;
	Toggle: FC<SettingToggleProps>;
	Search: FC<SettingSearchProps>;
	ExtraButton: FC<SettingExtraButtonProps>;
} = ({ className, name, desc, heading, children }) => {
	return (
		<div
			className={`setting-item ${className || ''} ${
				heading ? 'setting-item-heading' : ''
			}`}
		>
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				<div className="setting-item-description">{desc}</div>
			</div>
			<div className="setting-item-control">{children}</div>
		</div>
	);
};

Setting.Text = ({ value, placeHolder, onChange }) => {
	return (
		<input
			type="text"
			value={value}
			placeholder={placeHolder}
			onChange={onChange}
		/>
	);
};

Setting.Button = ({ onClick, cta, children }) => {
	return (
		<button className={cta ? 'mod-cta' : ''} onClick={onClick}>
			{children}
		</button>
	);
};

Setting.Dropdown = ({ options = {}, onChange, value, disabled = false }) => {
	return (
		<select
			disabled={disabled}
			className="dropdown"
			onChange={onChange}
			value={value}
		>
			{Object.entries(options).map(([val, { displayValue }], index) => {
				return (
					<option key={index} value={val}>
						{displayValue}
					</option>
				);
			})}
		</select>
	);
};

Setting.Search = ({ value, placeHolder, onChange, suggestions }) => {
	return (
		<div className="search-input-container">
			<Dropdown
				overlay={
					<div className="search-suggestions">
						{suggestions?.map((suggestion, index) => (
							<div
								key={index}
								className="search-suggestion"
								onClick={() => onChange?.(suggestion)}
							>
								{suggestion}
							</div>
						))}
					</div>
				}
				trigger={['click']}
			>
				<input
					type="text"
					value={value}
					placeholder={placeHolder}
					onChange={(e) => onChange?.(e.target.value)}
				/>
			</Dropdown>
		</div>
	);
};

Setting.ExtraButton = ({ icon, onClick, ariaLabel }) => {
	return (
		<div
			className="setting-item-control-extra"
			onClick={onClick}
			aria-label={ariaLabel}
		>
			{icon}
		</div>
	);
};

Setting.Toggle = ({ checked, onChange }) => {
	return (
		<input
			type="checkbox"
			checked={checked}
			onChange={onChange}
		/>
	);
};

export default Setting;
