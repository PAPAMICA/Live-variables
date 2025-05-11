import LiveVariables from "src/main";

const metadataCacheChangeEvent = (plugin: LiveVariables) => plugin.app.metadataCache.on('changed', (path, _, cache) => {
    const frontmatterProperties = cache.frontmatter;
    const propertyChanged = plugin.vaultProperties.propertyChanged(
        frontmatterProperties
    );
    if (propertyChanged) {
        const file = plugin.app.vault.getFileByPath(path.path);
        if (file) {
            plugin.renderVariables(file);
            plugin.vaultProperties.updateProperties(file);
        }
    }
})

export default metadataCacheChangeEvent;