/// <reference types="vite/client" />

import type React from 'react';
import type { ElectronAPI } from '../preload/index';

declare global {
  interface Window {
    electron: ElectronAPI;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: string;
      };
    }
  }
}

export {};
