import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initLocale } from '@/i18n';
import './styles/global.css';
import './styles/layout.css';

// Initialize locale (read user override or browser language) before rendering
initLocale().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
