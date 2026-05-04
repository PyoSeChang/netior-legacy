import React from 'react';
import { useEditorStore } from '../../../stores/editor-store';
import { FloatWindow } from './FloatWindow';

export function FloatWindowLayer(): JSX.Element | null {
  const { tabs, activeTabId, setActiveTab } = useEditorStore();

  const floatTabs = tabs.filter((t) => t.viewMode === 'float' && !t.isMinimized);

  if (floatTabs.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {floatTabs.map((tab) => (
        <FloatWindow
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onActivate={() => setActiveTab(tab.id)}
        />
      ))}
    </div>
  );
}
