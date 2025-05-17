import { App, PluginSettingTab } from 'obsidian';
import React from 'react';
import { createRoot } from 'react-dom/client';
import LiveVariablesReactSettingTab from './components/LiveVariableReactSettingTab';
import LiveVariable from './main';

export class LiveVariablesSettingTab extends PluginSettingTab {
  plugin: LiveVariable;
  constructor(app: App, plugin: LiveVariable) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    createRoot(containerEl).render(
      <LiveVariablesReactSettingTab plugin={this.plugin} />
    );
  }
} 