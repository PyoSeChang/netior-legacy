import React, { useEffect } from 'react';
import { useProjectStore } from './stores/project-store';
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
    currentProject,
    loadProjects,
    missingPathProject,
    resolveMissingPath,
    dismissMissingPath,
  } = useProjectStore();
  useNetiorSync(currentProject?.id ?? null);
  const {
    showSettings,
    showShortcutOverlay,
    setShowSettings,
    setShowShortcutOverlay,
  } = useUIStore();

  useEffect(() => {
    loadProjects().catch(() => {});
  }, [loadProjects]);

  return (
    <div className="relative h-full bg-surface-chrome text-default">
      <WorkspaceShell project={currentProject} rightChrome={<TitleBar />} />
      <ConfirmDialog
        open={!!missingPathProject}
        onClose={dismissMissingPath}
        onConfirm={resolveMissingPath}
        variant="primary"
        title={t('project.missingPathTitle')}
        message={t('project.missingPathMessage', { path: missingPathProject?.root_dir ?? '' })}
        confirmLabel={t('project.selectNewPath')}
      />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ShortcutOverlay open={showShortcutOverlay} onClose={() => setShowShortcutOverlay(false)} />
      <ToastContainer />
      <MissingFilesDialog />
    </div>
  );
}
