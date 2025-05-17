import { App, PluginSettingTab } from 'obsidian';
import React from 'react';
import { createRoot } from 'react-dom/client';
import LiveVariablesReactSettingTab from './components/LiveVariableReactSettingTab';
import LiveVariable from './main';

export class LiveVariablesSettingTab extends PluginSettingTab {
  plugin: LiveVariable;
  root: ReturnType<typeof createRoot> | null = null;

  constructor(app: App, plugin: LiveVariable) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.root = createRoot(containerEl);
    this.root.render(
      <LiveVariablesReactSettingTab plugin={this.plugin} />
    );
  }

  hide(): void {
    this.root?.unmount();
    this.root = null;
  }
} 