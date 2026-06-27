import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/sidepanel/styles/tokens.css';
import './styles/options.css';

createRoot(document.getElementById('root')!).render(<App />);
