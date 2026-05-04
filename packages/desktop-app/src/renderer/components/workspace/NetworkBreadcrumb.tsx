import React from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useI18n } from '../../hooks/useI18n';

export function NetworkBreadcrumb(): JSX.Element | null {
  const { breadcrumbs, networkHistory, navigateToBreadcrumb, navigateBack } =
    useNetworkStore();

  const { t } = useI18n();

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="flex min-w-0 items-center gap-1 bg-transparent px-1 py-1">
      <button
        className="flex items-center justify-center rounded p-0.5 text-secondary hover:bg-state-hover disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={networkHistory.length === 0}
        onClick={() => navigateBack()}
        aria-label={t('network.navigateBack')}
      >
        <ArrowLeft size={14} />
      </button>

      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        const label = crumb.networkName;

        return (
          <React.Fragment key={crumb.networkId}>
            {idx > 0 && (
              <ChevronRight size={12} className="shrink-0 text-muted" />
            )}
            {isLast ? (
              <span className="max-w-[180px] truncate text-xs font-medium text-accent">
                {label}
              </span>
            ) : (
              <button
                className="max-w-[160px] truncate text-xs text-secondary hover:text-default hover:underline"
                onClick={() => navigateToBreadcrumb(crumb.networkId)}
              >
                {label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
