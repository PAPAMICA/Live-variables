# Simple Live Variable

🇬🇧 A simplified version of the Live Variables plugin for Obsidian. This version keeps only the display, editing, and insertion functionality for variables.

🇫🇷 Une version simplifiée du plugin Live Variables pour Obsidian. Cette version conserve uniquement les fonctionnalités d'affichage, d'édition et d'insertion de variables.

## Gif & Screenshots
![demo.gif](/demo/demo.gif)
![settings](/demo/settings.png)

## Installation
🇬🇧
1. Create a `live-variables-lite` folder in your `.obsidian/plugins/` directory
2. Copy the `main.js` and `manifest.json` files to this folder
3. Restart Obsidian or enable the plugin in settings

---
🇫🇷
1. Créez un dossier `live-variables-lite` dans votre dossier `.obsidian/plugins/`
2. Copiez les fichiers `main.js` et `manifest.json` dans ce dossier
3. Redémarrez Obsidian ou activez le plugin dans les paramètres

## Features / Fonctionnalités

- **Variable display** / **Affichage des variables**: Automatically replaces variables in text with their values
- **Variable editing** / **Édition des variables**: Click on any variable to edit its value directly
- **Variable insertion** / **Insertion de variables**: Use the command to insert variables from the frontmatter
- **Change persistence** / **Persistance des modifications**: Changes are saved in the file's frontmatter
- **Smart copy** / **Copie intelligente**: When copying a code block containing variables, the values are copied, not the delimiters

## How to use / Comment utiliser

### 🇬🇧 English

1. Add variables in the YAML frontmatter of your Markdown files:
```yaml
---
user: papamica
ip: 192.168.1.1
port: 22
---
```

2. Use these variables in your text with delimiters (default `{{` and `}}`):
```
SSH connection: ssh {{user}}@{{ip}} -p {{port}}
```

3. To insert a variable:
   - Place your cursor where you want to insert the variable
   - Open the command palette (Ctrl/Cmd+P)
   - Type "Insert variable" and select the command
   - Quickly search for a variable by typing in the search field
   - Choose the variable to insert from the list
   - Use keyboard arrows to navigate and Enter to select

4. To edit a variable:
   - In preview mode, simply click on any variable
   - Edit its value in the popup
   - Click "Save" or press Enter

### 🇫🇷 Français

1. Ajoutez des variables dans le frontmatter YAML de vos fichiers Markdown :
```yaml
---
user: papamica
ip: 192.168.1.1
port: 22
---
```

2. Utilisez ces variables dans votre texte avec les délimiteurs (par défaut `{{` et `}}`) :
```
Connexion SSH : ssh {{user}}@{{ip}} -p {{port}}
```

3. Pour insérer une variable :
   - Placez votre curseur où vous souhaitez insérer la variable
   - Ouvrez la palette de commandes (Ctrl/Cmd+P)
   - Tapez "Insérer une variable" et sélectionnez la commande
   - Recherchez rapidement une variable en tapant dans le champ de recherche
   - Choisissez la variable à insérer dans la liste
   - Utilisez les flèches du clavier pour naviguer et Entrée pour sélectionner

4. Pour modifier une variable :
   - En mode prévisualisation, cliquez simplement sur n'importe quelle variable
   - Modifiez sa valeur dans le popup
   - Cliquez sur "Enregistrer" ou appuyez sur Entrée

## Configuration

### 🇬🇧 English

In the plugin settings, you can:
- Change the language between English and French
- Change the delimiters for variables
- Enable/disable variable highlighting
- Choose the color for highlighted variables

### 🇫🇷 Français

Dans les paramètres du plugin, vous pouvez :
- Changer la langue entre l'anglais et le français
- Changer les délimiteurs pour les variables
- Activer/désactiver la mise en évidence des variables
- Choisir la couleur des variables