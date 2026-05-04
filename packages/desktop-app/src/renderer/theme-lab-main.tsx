import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeLab } from './components/dev/ThemeLab';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeLab />
  </React.StrictMode>,
);
