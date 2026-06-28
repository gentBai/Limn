import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export const manifest = defineManifest({
  manifest_version: 3,
  name: 'Limn',
  version: pkg.version,
  description: 'AI-powered web reading assistant — summaries, translation, multi-model support',
  default_locale: 'en',
  icons: {
    16: 'public/icons/icon-16.png',
    24: 'public/icons/icon-24.png',
    32: 'public/icons/icon-32.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  action: {
    default_title: 'Limn',
    default_icon: {
      16: 'public/icons/icon-16.png',
      24: 'public/icons/icon-24.png',
      32: 'public/icons/icon-32.png',
      48: 'public/icons/icon-48.png',
      128: 'public/icons/icon-128.png',
    },
  },
  background: { service_worker: 'src/background/background.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  options_page: 'src/options/index.html',
  permissions: ['activeTab', 'storage', 'sidePanel', 'tabs'],
  host_permissions: [
    'https://api.openai.com/*',
    'https://api.deepseek.com/*',
    'https://open.bigmodel.cn/*',
    'https://api.anthropic.com/*',
    'http://localhost:11434/*',
  ],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content-script/index.ts'],
      run_at: 'document_idle',
    },
  ],
});
