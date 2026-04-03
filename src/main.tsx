import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { installMockElectronApi } from './lib/mockElectronApi';
import './styles/globals.css';

installMockElectronApi();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
