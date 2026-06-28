import React, { useEffect } from 'react';
import { useWorldStore } from './stores/world-store';
import { useUIStore } from './stores/ui-store';
import { useI18n } from './hooks/useI18n';
import { WorkspaceShell } from './components/workspace/WorkspaceShell';
import { SettingsModal } from './components/settings/SettingsModal';
import { ShortcutOverlay } from './components/shortcuts/ShortcutOverlay';
import { ToastContainer } from './components/ui/Toast';
import { WindowControls } from './components/ui/WindowControls';
import { MissingFilesDialog } from './components/home/MissingFilesDialog';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { WorldHome } from './components/home/WorldHome';
import { useGlobalShortcuts } from './shortcuts/useGlobalShortcuts';
import { useNetiorSync } from './hooks/useNetiorSync';
import { openFileTab } from './lib/open-file-tab';
import { getWorldRootDir } from './utils/world-utils';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function isPathInsideRoot(filePath: string, rootDir: string): boolean {
  const file = normalizePath(filePath);
  const root = normalizePath(rootDir);
  return file === root || file.startsWith(`${root}/`);
}

export default function App(): JSX.Element {
  useGlobalShortcuts();
  const { t } = useI18n();

  const {
    currentWorld,
    loadWorlds,
    missingPathWorld,
    resolveMissingPath,
    dismissMissingPath,
  } = useWorldStore();
  useNetiorSync(currentWorld?.id ?? null);
  const {
    showSettings,
    showShortcutOverlay,
    setShowSettings,
    setShowShortcutOverlay,
  } = useUIStore();

  useEffect(() => {
    loadWorlds().catch(() => {});
  }, [loadWorlds]);

  useEffect(() => {
    window.electron.app.updateWorldContext({
      rootNetworkId: currentWorld?.id ?? null,
      worldRoot: currentWorld ? getWorldRootDir(currentWorld) : null,
    });
  }, [currentWorld]);

  useEffect(() => {
    const cleanup = window.electron.app.onOpenFiles((filePaths) => {
      void (async () => {
        if (filePaths.length === 0) return;

        await loadWorlds();
        const worlds = useWorldStore.getState().worlds;

        for (const filePath of filePaths) {
          const matchingWorld = worlds
            .filter((world) => {
              const rootDir = getWorldRootDir(world);
              return rootDir ? isPathInsideRoot(filePath, rootDir) : false;
            })
            .sort((a, b) => normalizePath(getWorldRootDir(b)).length - normalizePath(getWorldRootDir(a)).length)[0];

          if (matchingWorld && useWorldStore.getState().currentWorld?.id !== matchingWorld.id) {
            await useWorldStore.getState().openWorld(matchingWorld);
          }

          await openFileTab({
            filePath,
            placement: 'smart',
            rootNetworkId: matchingWorld?.id,
          });
        }
      })();
    });
    window.electron.app.readyForOpenFiles();
    return cleanup;
  }, [loadWorlds]);

  return (
    <div className="relative h-full bg-surface-chrome text-default">
      {currentWorld ? (
        <WorkspaceShell world={currentWorld} windowControls={<WindowControls />} />
      ) : (
        <WorldHome windowControls={<WindowControls />} />
      )}
      <ConfirmDialog
        open={!!missingPathWorld}
        onClose={dismissMissingPath}
        onConfirm={resolveMissingPath}
        variant="primary"
        title={t('world.missingPathTitle')}
        message={t('world.missingPathMessage', { path: getWorldRootDir(missingPathWorld) })}
        confirmLabel={t('world.selectNewPath')}
      />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ShortcutOverlay open={showShortcutOverlay} onClose={() => setShowShortcutOverlay(false)} />
      <ToastContainer />
      <MissingFilesDialog />
    </div>
  );
}
