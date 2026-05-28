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

  useEffect(() => {
    window.electron.app.updateProjectContext({
      projectId: currentProject?.id ?? null,
      projectRoot: currentProject?.root_dir ?? null,
    });
  }, [currentProject?.id, currentProject?.root_dir]);

  useEffect(() => {
    const cleanup = window.electron.app.onOpenFiles((filePaths) => {
      void (async () => {
        if (filePaths.length === 0) return;

        await loadProjects();
        const projects = useProjectStore.getState().projects;

        for (const filePath of filePaths) {
          const matchingProject = projects
            .filter((project) => isPathInsideRoot(filePath, project.root_dir))
            .sort((a, b) => normalizePath(b.root_dir).length - normalizePath(a.root_dir).length)[0];

          if (matchingProject && useProjectStore.getState().currentProject?.id !== matchingProject.id) {
            await useProjectStore.getState().openProject(matchingProject);
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
