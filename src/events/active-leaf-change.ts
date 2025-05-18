import LiveVariables from 'src/main';

const activeLeafChangeEvent = (plugin: LiveVariables) =>
	plugin.app.workspace.on('active-leaf-change', (_leaf) => {
		const file = plugin.app.workspace.getActiveFile();
		if (file) {
			plugin.vaultProperties.updateProperties(file);
			plugin.renderVariables(file);
		}
	});

export default activeLeafChangeEvent;
