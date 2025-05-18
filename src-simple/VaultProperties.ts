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

	updateVaultProperties() {
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
	
	// Méthode pour mettre à jour une variable (temporaire et permanente)
	async temporaryUpdateVariable(path: string, value: any) {
		// Stocker la valeur dans notre Map temporaire
		this.temporaryVariables.set(path, value);
		
		// Essayer de mettre à jour de manière permanente si possible
		const currentFile = this.app.workspace.getActiveFile();
		if (currentFile) {
			// Essayons de mettre à jour dans le frontmatter
			try {
				// Pour les variables globales
				if (path.includes('/')) {
					const [filePath, propPath] = path.split('/');
					const targetFile = this.app.vault.getFileByPath(filePath);
					if (targetFile) {
						await this.updateFrontmatterProperty(targetFile, propPath, value);
					}
				} 
				// Pour les variables locales
				else {
					await this.updateFrontmatterProperty(currentFile, path, value);
				}
			} catch (error) {
				console.error("Erreur lors de la mise à jour du frontmatter:", error);
				throw error;
			}
		}
		
		console.log(`Variable ${path} mise à jour avec la valeur ${value}`);
	}
	
	// Méthode pour mettre à jour une propriété dans le frontmatter d'un fichier
	async updateFrontmatterProperty(file: TFile, propertyPath: string, value: any) {
		try {
			// Obtenir le contenu actuel du fichier
			const fileContent = await this.app.vault.read(file);
			
			// Vérifier si le fichier a un frontmatter
			if (!fileContent.startsWith("---")) {
				// Créer un nouveau frontmatter avec la propriété
				const formattedValue = this.formatValueForYaml(value);
				const newFileContent = `---\n${propertyPath}: ${formattedValue}\n---\n\n${fileContent}`;
				
				// Sauvegarder les changements
				await this.app.vault.modify(file, newFileContent);
				console.log(`Nouveau frontmatter créé avec la propriété ${propertyPath} dans ${file.path}`);
				return;
			}
			
			// Trouver la fin du frontmatter
			const endOfFrontmatter = fileContent.indexOf("---", 3);
			if (endOfFrontmatter === -1) {
				// Frontmatter mal formé, essayer de le réparer
				const formattedValue = this.formatValueForYaml(value);
				const newFileContent = `---\n${propertyPath}: ${formattedValue}\n---\n\n${fileContent.substring(3)}`;
				
				// Sauvegarder les changements
				await this.app.vault.modify(file, newFileContent);
				console.log(`Frontmatter réparé avec la propriété ${propertyPath} dans ${file.path}`);
				return;
			}
			
			// Extraire le frontmatter
			const frontmatter = fileContent.substring(3, endOfFrontmatter).trim();
			const restOfFile = fileContent.substring(endOfFrontmatter);
			
			// Pour les propriétés simples (sans points)
			if (!propertyPath.includes('.')) {
				// Chercher la ligne correspondant à la propriété
				const regex = new RegExp(`^${propertyPath}\\s*:.*$`, 'm');
				const match = frontmatter.match(regex);
				
				let newFrontmatter;
				// Si la propriété existe déjà, la remplacer
				if (match) {
					const formattedValue = this.formatValueForYaml(value);
					newFrontmatter = frontmatter.replace(
						regex, 
						`${propertyPath}: ${formattedValue}`
					);
				} 
				// Sinon, l'ajouter à la fin du frontmatter
				else {
					const formattedValue = this.formatValueForYaml(value);
					newFrontmatter = `${frontmatter}\n${propertyPath}: ${formattedValue}`;
				}
				
				// Reconstruire le fichier avec le nouveau frontmatter
				const newFileContent = `---\n${newFrontmatter}\n${restOfFile}`;
				
				// Sauvegarder les changements
				await this.app.vault.modify(file, newFileContent);
				console.log(`Propriété ${propertyPath} mise à jour dans ${file.path}`);
			}
			// Pour les propriétés imbriquées (avec des points)
			else {
				// Une implémentation simple pour les propriétés à un niveau d'imbrication
				const [parent, child] = propertyPath.split('.');
				
				if (child) { // S'assurer qu'il y a bien une propriété enfant
					// Chercher la ligne parent
					const parentRegex = new RegExp(`^${parent}\\s*:.*$`, 'm');
					const parentMatch = frontmatter.match(parentRegex);
					
					let newFrontmatter;
					if (parentMatch) {
						// Vérifier si c'est un objet ou une valeur simple
						const parentLine = parentMatch[0];
						const indentedRegex = new RegExp(`^(\\s+)${child}\\s*:.*$`, 'm');
						const indentedMatch = frontmatter.match(indentedRegex);
						
						if (indentedMatch) {
							// La propriété enfant existe, la remplacer
							const formattedValue = this.formatValueForYaml(value);
							newFrontmatter = frontmatter.replace(
								indentedRegex,
								`${indentedMatch[1]}${child}: ${formattedValue}`
							);
						} else {
							// Faut-il convertir le parent en objet?
							if (parentLine.trim().endsWith(':')) {
								// Le parent est déjà un objet, ajouter la propriété enfant
								const formattedValue = this.formatValueForYaml(value);
								newFrontmatter = frontmatter.replace(
									parentRegex,
									`${parentMatch[0]}\n  ${child}: ${formattedValue}`
								);
							} else {
								// Le parent est une valeur simple, on doit le convertir en objet
								const formattedValue = this.formatValueForYaml(value);
								newFrontmatter = frontmatter.replace(
									parentRegex,
									`${parent}:\n  ${child}: ${formattedValue}`
								);
							}
						}
					} else {
						// Le parent n'existe pas, créer l'objet complet
						const formattedValue = this.formatValueForYaml(value);
						newFrontmatter = `${frontmatter}\n${parent}:\n  ${child}: ${formattedValue}`;
					}
					
					// Reconstruire le fichier avec le nouveau frontmatter
					const newFileContent = `---\n${newFrontmatter}\n${restOfFile}`;
					
					// Sauvegarder les changements
					await this.app.vault.modify(file, newFileContent);
					console.log(`Propriété imbriquée ${propertyPath} mise à jour dans ${file.path}`);
				} else {
					console.log(`Propriété imbriquée ${propertyPath} mal formée`);
				}
			}
		} catch (error) {
			console.error("Erreur lors de la mise à jour du frontmatter:", error);
			throw error; // Propager l'erreur
		}
	}
	
	// Formater une valeur pour YAML
	formatValueForYaml(value: any): string {
		// Si c'est une chaîne
		if (typeof value === 'string') {
			// Si la chaîne contient des caractères spéciaux, l'entourer de guillemets
			if (value.match(/[:#\[\]{},%&*()='"|><]/)) {
				// Échapper les guillemets dans la chaîne
				const escapedValue = value.replace(/"/g, '\\"');
				return `"${escapedValue}"`;
			}
			return value;
		}
		// Si c'est un nombre ou un booléen
		else if (typeof value === 'number' || typeof value === 'boolean') {
			return value.toString();
		}
		// Si c'est null ou undefined
		else if (value === null || value === undefined) {
			return 'null';
		}
		// Si c'est un objet ou un tableau, le convertir en JSON
		else {
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}
	}
}
