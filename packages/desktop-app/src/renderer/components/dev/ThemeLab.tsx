import type { JSX } from 'react';

export function ThemeLab(): JSX.Element {
  return (
    <div className="min-h-screen bg-surface-editor p-6 text-default">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="border-b border-default pb-4">
          <h1 className="text-lg font-semibold">Netior Theme Lab</h1>
          <p className="mt-1 text-sm text-secondary">
            Developer surface for checking semantic theme tokens.
          </p>
        </header>
        <section className="grid gap-3 md:grid-cols-3">
          {['surface-panel', 'surface-card', 'surface-hover'].map((token) => (
            <div key={token} className="rounded border border-default bg-surface-panel p-4">
              <div className="text-xs text-muted">{token}</div>
              <div className="mt-2 h-12 rounded bg-surface-card" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
