// Types for translations
interface Translations {
    settings: {
        language: {
            name: string;
            desc: string;
        };
        delimiters: {
            name: string;
            desc: string;
        };
        highlight: {
            name: string;
            desc: string;
        };
        color: {
            name: string;
            desc: string;
        };
    };
    commands: {
        insertVariable: string;
    };
    ui: {
        editVariable: string;
        cancel: string;
        save: string;
        newValue: string;
        noVariables: string;
        selectVariable: string;
        variableUpdated: string;
        updateError: string;
        searchVariable: string;
    };
}

const en: Translations = {
    settings: {
        language: {
            name: "Language",
            desc: "Change the language of the plugin"
        },
        delimiters: {
            name: "Variable delimiters",
            desc: "Set the delimiters for variables"
        },
        highlight: {
            name: "Highlight dynamic variables",
            desc: "Highlight variables with a color to distinguish them from normal text"
        },
        color: {
            name: "Highlight color",
            desc: "Choose the color for highlighted variables"
        }
    },
    commands: {
        insertVariable: "Insert variable"
    },
    ui: {
        editVariable: "Edit variable",
        cancel: "Cancel",
        save: "Save",
        newValue: "New value",
        noVariables: "No variables available. Add variables in the YAML frontmatter.",
        selectVariable: "Select a variable",
        variableUpdated: "Variable updated",
        updateError: "Error updating variable",
        searchVariable: "Search variable..."
    }
};

const fr: Translations = {
    settings: {
        language: {
            name: "Langue",
            desc: "Changer la langue du plugin"
        },
        delimiters: {
            name: "Délimiteurs de variables",
            desc: "Définir les délimiteurs pour les variables"
        },
        highlight: {
            name: "Surligner les variables dynamiques",
            desc: "Surligner les variables avec une couleur pour les distinguer du texte normal"
        },
        color: {
            name: "Couleur de surlignage",
            desc: "Choisir la couleur pour les variables surlignées"
        }
    },
    commands: {
        insertVariable: "Insérer une variable"
    },
    ui: {
        editVariable: "Modifier la variable",
        cancel: "Annuler",
        save: "Enregistrer",
        newValue: "Nouvelle valeur",
        noVariables: "Aucune variable disponible. Ajoutez des variables dans le frontmatter YAML.",
        selectVariable: "Sélectionner une variable",
        variableUpdated: "Variable mise à jour",
        updateError: "Erreur lors de la mise à jour de la variable",
        searchVariable: "Rechercher une variable..."
    }
};

// Get translations based on language setting
export function getTranslations(language: 'en' | 'fr'): Translations {
    return language === 'en' ? en : fr;
} 