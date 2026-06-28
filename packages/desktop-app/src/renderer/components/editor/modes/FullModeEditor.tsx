import React, { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { SplitLeaf, EditorTab } from '../../../types/editor';
import { useEditorStore, containsTab } from '../../../stores/editor-store';
import { EditorViewModeMenu } from '../EditorViewModeSwitch';
import { EditorContent } from '../EditorContent';
import { EditorTabStrip } from '../EditorTabStrip';
import { isTopRightPane, SplitPaneRenderer, type PaneAdjacency } from '../SplitPaneRenderer';
import { DropZoneOverlay } from '../DropZoneOverlay';
import { isTabDrag } from '../../../hooks/useTabDrag';
import { isFileOpenDrag } from '../../../hooks/useFileOpenDrag';
import { isEditableMentionDropTarget } from '../../../hooks/useNarreMentionDrag';
import { openFileBesideTab, openFileInPane } from '../../../lib/open-file-tab';
import { getAllowedViewModes } from '../../../lib/editor-view-mode-rules';
import type { DropResult } from '../DropZoneOverlay';

interface FullModeEditorProps {
  windowControls?: React.ReactNode;
}

async function openDroppedFilesInFullLeaf(
  filePaths: string[],
  leaf: SplitLeaf,
  drop?: Omit<DropResult, 'tabId'>,
): Promise<void> {
  if (filePaths.length === 0) return;
  if (!drop || drop.zone === 'center') {
    for (const filePath of filePaths) {
      await openFileInPane(filePath, leaf.activeTabId, 'full');
    }
    return;
  }

  let targetTabId = await openFileBesideTab(filePaths[0], leaf.activeTabId, 'full', drop.direction, drop.position);
  for (const filePath of filePaths.slice(1)) {
    await openFileInPane(filePath, targetTabId, 'full');
    targetTabId = `file:${filePath}`;
  }
}

export function FullModeEditor({ windowControls = null }: FullModeEditorProps): JSX.Element | null {
  const {
    tabs, activeTabId, fullLayout,
    setActiveTab, requestCloseTab, setViewMode, toggleMinimize,
    updateSplitRatio, splitTab, moveTabToPane, moveTabWithinStrip,
  } = useEditorStore();
  const layoutActiveTabId = useEditorStore((s) => {
    if (!s.activeTabId || !s.fullLayout) return null;
    return containsTab(s.fullLayout, s.activeTabId) ? s.activeTabId : null;
  });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const reset = () => setIsDragging(false);
    document.addEventListener('dragend', reset);
    return () => document.removeEventListener('dragend', reset);
  }, []);

  const renderFullLeaf = useCallback(
    (leaf: SplitLeaf, adjacency?: PaneAdjacency) => {
      const leafTabs = leaf.tabIds
        .map((id) => tabs.find((t) => t.id === id))
        .filter((t): t is EditorTab => t != null);
      const activeTab = leafTabs.find((t) => t.id === leaf.activeTabId) ?? leafTabs[0];
      const isActivePane = layoutActiveTabId ? leaf.tabIds.includes(layoutActiveTabId) : false;
      const showWindowControls = Boolean(windowControls && isTopRightPane(adjacency));

      return (
        <div
          className="flex h-full min-h-0 flex-col overflow-visible"
          onMouseDown={() => {
            if (!leaf.tabIds.includes(activeTabId!)) {
              setActiveTab(leaf.activeTabId);
            }
          }}
        >
          <EditorTabStrip
            tabs={leafTabs}
            activeTabId={leaf.activeTabId}
            isFocusedPane={isActivePane}
            onActivate={setActiveTab}
            onClose={requestCloseTab}
            onTabDrop={(droppedId) => moveTabToPane(droppedId, leaf.activeTabId, 'full')}
            onTabReorder={moveTabWithinStrip}
            onFileDrop={(filePaths) => { void openDroppedFilesInFullLeaf(filePaths, leaf); }}
            rightSlot={showWindowControls ? windowControls : undefined}
            leftSlot={
              <EditorViewModeMenu
                currentMode="full"
                availableModes={getAllowedViewModes(activeTab)}
                onModeChange={(mode) => setViewMode(leaf.activeTabId, mode)}
                onMinimize={() => toggleMinimize(leaf.activeTabId)}
              />
            }
          />
          <div className={`pane-surface pane-surface--editor relative flex-1 min-h-0 overflow-hidden ${
            adjacency?.bottom ? 'pane-surface--adjacent-bottom' : ''
          }`}>
            {activeTab && <EditorContent tab={activeTab} />}
            <DropZoneOverlay
              onDrop={(result) => {
                flushSync(() => setIsDragging(false));
                if (result.zone === 'center') {
                  moveTabToPane(result.tabId, leaf.activeTabId, 'full');
                } else {
                  const targetId = leaf.tabIds.find((id) => id !== result.tabId) ?? leaf.activeTabId;
                  if (targetId !== result.tabId || leaf.tabIds.length > 1) {
                    splitTab(targetId, result.tabId, result.direction, result.position);
                  }
                }
              }}
              onFileDrop={(filePaths, result) => {
                flushSync(() => setIsDragging(false));
                void openDroppedFilesInFullLeaf(filePaths, leaf, result);
              }}
              active={isDragging}
            />
          </div>
        </div>
      );
    },
    [tabs, isDragging, activeTabId, layoutActiveTabId, fullLayout, windowControls, setActiveTab, requestCloseTab, setViewMode, toggleMinimize, moveTabToPane, moveTabWithinStrip, splitTab],
  );

  if (!fullLayout) return null;

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 bg-surface-chrome"
      onDragEnter={(e) => { if (!isEditableMentionDropTarget(e.target) && (isTabDrag(e) || isFileOpenDrag(e))) setIsDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
      onDrop={() => setIsDragging(false)}
    >
      <SplitPaneRenderer
        node={fullLayout}
        mode="full"
        renderLeaf={renderFullLeaf}
        onRatioChange={updateSplitRatio}
      />
    </div>
  );
}
