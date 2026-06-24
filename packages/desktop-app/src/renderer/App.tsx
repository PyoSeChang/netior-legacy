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
import { useGlobalShortcuts } from './shortcuts/useGlobalShortcuts';
import { useNetiorSync } from './hooks/useNetiorSync';
import { openFileTab } from './lib/open-file-tab';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function isPathInsideRoot(filePath: string, rootDir: string): boolean {
  const file = normalizePath(filePath);
  const root = normalizePath(rootDir);
  return file === root || file.startsWith(`${root}/`);
}

function TitleBar(): JSX.Element {
  return (
    <div
      className="tab-strip workspace-title-strip relative z-[1000] flex h-[35px] shrink-0 items-center justify-end text-default"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <WindowControls />
    </div>
  );
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
      worldRoot: currentWorld?.root_dir ?? null,
    });
  }, [currentWorld?.id, currentWorld?.root_dir]);

  useEffect(() => {
    const cleanup = window.electron.app.onOpenFiles((filePaths) => {
      void (async () => {
        if (filePaths.length === 0) return;

        await loadWorlds();
        const worlds = useWorldStore.getState().worlds;

        for (const filePath of filePaths) {
          const matchingWorld = worlds
            .filter((world) => isPathInsideRoot(filePath, world.root_dir))
            .sort((a, b) => normalizePath(b.root_dir).length - normalizePath(a.root_dir).length)[0];

          if (matchingWorld && useWorldStore.getState().currentWorld?.id !== matchingWorld.id) {
            await useWorldStore.getState().openWorld(matchingWorld);
          }

          await openFileTab({
            filePath,
            placement: 'smart',
          });
        }
      })();
    });
    window.electron.app.readyForOpenFiles();
    return cleanup;
  }, [loadWorlds]);

  return (
    <div className="relative h-full bg-surface-chrome text-default">
      <WorkspaceShell world={currentWorld} rightChrome={<TitleBar />} />
      <ConfirmDialog
        open={!!missingPathWorld}
        onClose={dismissMissingPath}
        onConfirm={resolveMissingPath}
        variant="primary"
        title={t('world.missingPathTitle')}
        message={t('world.missingPathMessage', { path: missingPathWorld?.root_dir ?? '' })}
        confirmLabel={t('world.selectNewPath')}
      />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ShortcutOverlay open={showShortcutOverlay} onClose={() => setShowShortcutOverlay(false)} />
      <ToastContainer />
      <MissingFilesDialog />
    </div>
  );
}
