import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initLocale } from '@/i18n';
import '@/sidepanel/styles/tokens.css';
import './styles/options.css';

initLocale().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
