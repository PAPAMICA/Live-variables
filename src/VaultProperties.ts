import { App, FileSystemAdapter, FrontMatterCache, TFile } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import { stringifyIfObj, trancateString } from './utils';
import { Property } from './property-selection-modal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Properties = Record<string, any> | string | number | undefined;

export default class VaultProperties {
	private app: App;
	private vaultBasePath: string;
	private properties: Properties;
	private localProperties: Properties;
	private localKeysAndAllVariableKeys: string[];
	private localKeys: string[];
	private temporaryVariables: Map<string, any> = new Map();

	constructor(app: App) {
		this.app = app;
		this.vaultBasePath = (
			app.vault.adapter as FileSystemAdapter
		).getBasePath();
		this.updateVaultProperties();
	}

	propertyChanged = (newProperties: FrontMatterCache | undefined) => {
		if (
			Object.entries(this.localProperties ?? {}).length !==
			Object.entries(newProperties ?? {}).length
		) {
			return true;
		}
		for (const [newPropKey, newPropVal] of Object.entries(
			newProperties ?? {}
		)) {
			if (typeof this.localProperties === 'object') {
				const currentPropVal = this.localProperties?.[newPropKey];
				if (
					JSON.stringify(currentPropVal) !==
					JSON.stringify(newPropVal)
				) {
					return true;
				}
			}
		}
		return false;
	};

	private updateVaultProperties() {
		this.properties = this.getDirectoryTree(this.vaultBasePath);
	}

	updateProperties(file: TFile) {
		this.updateVaultProperties();
		this.localProperties = this.getValueByPath(this.properties, file.path);
		this.updateLocalKeysAndAllVariableKeys();
	}

	private getDirectoryTree(dirPath: string): Properties {
		const result: Properties = {};
		const items = fs.readdirSync(dirPath);

		for (const item of items) {
			if (item.startsWith('.obsidian')) continue; // Ignore Obsidian system folder

			const fullPath = path.join(dirPath, item);
			const stats = fs.statSync(fullPath);

			if (stats.isDirectory()) {
				result[item] = this.getDirectoryTree(fullPath); // Recurse into folders
			} else if (path.extname(item) === '.md') {
				result[item] = this.getMarkdownProperties(fullPath); // Only include Markdown files
			}
		}
		return result;
	}

	private getMarkdownProperties(
		markdownAbsoluteFilePath: string
	): Properties {
		const vaultPath =
			path.posix.join(...this.vaultBasePath.split(path.sep)) + '/';
		const markdownFilePath = path.posix
			.join(...markdownAbsoluteFilePath.split(path.sep))
			.slice(vaultPath.length);
		const file = this.app.vault.getFileByPath(markdownFilePath);
		if (file) {
			return this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		}
		return {};
	}

	getLocalProperty(key: string): Properties {
		return this.getValueByPath(this.localProperties, key);
	}

	getProperty(path: string): any {
		// Check first if we have a temporary override
		if (this.temporaryVariables.has(path)) {
			return this.temporaryVariables.get(path);
		}
		
		const currentFile = this.app.workspace.getActiveFile();
		if (!currentFile) return undefined;

		// Si le chemin contient un /, c'est une variable globale
		if (path.includes('/')) {
			const [filePath, propPath] = path.split('/');
			const file = this.app.vault.getFileByPath(filePath);
			if (!file) return undefined;
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) return undefined;
			return this.getValueByPath(frontmatter, propPath);
		}

		// Sinon, c'est une variable locale
		const frontmatter = this.app.metadataCache.getFileCache(currentFile)?.frontmatter;
		if (!frontmatter) return undefined;
		return this.getValueByPath(frontmatter, path);
	}

	getLocalProperties() {
		return this.localProperties;
	}

	private getValueByPath(obj: any, path: string): any {
		if (!obj || !path) return undefined;
		const keys = path.split('.');
		return keys.reduce((acc, key) => {
			if (acc && typeof acc === 'object' && acc.hasOwnProperty(key)) {
				return acc[key];
			}
			return undefined;
		}, obj);
	}

	getAllVariableKeys() {
		return this.getAllPaths(this.properties);
	}

	findPropertiesWithPathContaining(searchPath: string): Property[] {
		return this.findPathsContaining(searchPath).map((key) => ({
			key,
			value: stringifyIfObj(this.getProperty(key)),
		}));
	}

	findLocalPropertiesWithPathContaining(
		file: TFile,
		searchPath: string
	): Property[] {
		return this.findLocalPathsContaining(searchPath).map((key) => ({
			key,
			value: stringifyIfObj(this.getProperty(key)),
		}));
	}

	findLocalPathsContaining(searchPath: string): string[] {
		if (searchPath.length === 0) {
			return this.getLocalKeys();
		}
		return this.getLocalKeys().filter((path) => path.contains(searchPath));
	}

	findPathsContaining(searchPath: string): string[] {
		if (searchPath.length === 0) {
			return this.getLocalKeysAndAllVariableKeys();
		}
		return this.getLocalKeysAndAllVariableKeys().filter((path) =>
			path.contains(searchPath)
		);
	}

	findPathsStartingWith(searchPath: string): string[] {
		if (searchPath.length === 0) {
			return this.getLocalKeysAndAllVariableKeys();
		}
		return this.getLocalKeysAndAllVariableKeys().filter((path) =>
			path.startsWith(searchPath)
		);
	}

	updateLocalKeysAndAllVariableKeys() {
		this.localKeys = this.getAllPaths(this.getLocalProperties(), '', true);
		this.localKeysAndAllVariableKeys = [
			...this.localKeys,
			...this.getAllPaths(this.properties),
		];
	}

	getLocalKeysAndAllVariableKeys() {
		return this.localKeysAndAllVariableKeys;
	}

	getLocalKeys() {
		return this.localKeys;
	}

	private getAllPaths(
		obj: Properties,
		parentPath = '',
		local?: boolean
	): string[] {
		const isNestedProperty = parentPath.contains('.md/') || local;
		const separator = isNestedProperty ? '.' : '/';
		let paths: string[] = [];

		for (const [key, value] of Object.entries(obj ?? {})) {
			// Create the full path for the current key
			const fullPath = parentPath
				? `${parentPath}${separator}${key}`
				: key;

			paths.push(fullPath);

			if (typeof value === 'object') {
				// If it's a folder, recurse deeper
				paths = [...paths, ...this.getAllPaths(value, fullPath, local)];
			}
		}
		return paths;
	}

	getPropertyPreview(path: string) {
		const value = this.getProperty(path);
		return value ? trancateString(stringifyIfObj(value), 50) : 'no value';
	}
	
	// Méthode temporaire pour mettre à jour une variable en mémoire
	// Note: Cette mise à jour ne persiste que pour la session en cours
	// et sera perdue au redémarrage du plugin ou d'Obsidian
	temporaryUpdateVariable(path: string, value: any) {
		this.temporaryVariables.set(path, value);
		
		// Dans une implémentation réelle, vous voudriez mettre à jour le frontmatter du fichier
		// et le sauvegarder sur le disque pour une persistance réelle
		console.log(`Variable ${path} temporairement mise à jour avec la valeur ${value}`);
	}
}
