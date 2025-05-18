# Simple Live Variable

Une version simplifiée du plugin Live Variables pour Obsidian. Cette version conserve uniquement les fonctionnalités d'affichage, d'édition et d'insertion de variables.

## Fonctionnalités

- **Affichage des variables** : Remplace automatiquement les variables dans le texte par leurs valeurs
- **Édition des variables** : Cliquez sur une variable pour modifier sa valeur directement
- **Insertion de variables** : Utilisez la commande pour insérer des variables du frontmatter
- **Persistance des modifications** : Les modifications sont enregistrées dans le frontmatter du fichier
- **Copie intelligente** : Lorsque vous copiez un bloc de code contenant des variables, ce sont les valeurs des variables qui sont copiées, pas les délimiteurs

## Comment utiliser

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
   - Choisissez la variable à insérer dans la liste

4. Pour modifier une variable :
   - En mode prévisualisation, cliquez simplement sur n'importe quelle variable 
   - Modifiez sa valeur dans le popup
   - Cliquez sur "Enregistrer" ou appuyez sur Entrée

## Configuration

Dans les paramètres du plugin, vous pouvez :
- Changer les délimiteurs pour les variables
- Activer/désactiver la mise en évidence des variables
- Choisir la couleur des variables
