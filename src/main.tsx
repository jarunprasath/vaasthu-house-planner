import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// On small screens start with the side panels closed so the plan is visible.
import { useUiStore } from './store/uiStore';
import { useProjectStore } from './store/projectStore';
if (window.innerWidth < 1024) useUiStore.getState().setPanels({ leftOpen: false, rightOpen: false });

// Test hook: end-to-end tests open the app with ?e2e to read the stores.
if (new URLSearchParams(location.search).has('e2e')) {
  (window as unknown as { __vhp: unknown }).__vhp = { useProjectStore, useUiStore };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
