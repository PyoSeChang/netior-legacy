import React from 'react';

export function EditorScroll({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="h-full min-h-0 overflow-auto bg-surface-editor">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 p-8">
        {children}
      </div>
    </div>
  );
}

export function EditorHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
}): JSX.Element {
  return (
    <header className="min-w-0">
      <div className="text-xs font-medium text-accent">{eyebrow}</div>
      <h1 className="mt-1 truncate text-2xl font-semibold text-default">{title}</h1>
      {subtitle && <div className="mt-1 truncate text-xs text-muted">{subtitle}</div>}
    </header>
  );
}

export function EditorSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-xl border border-subtle bg-surface-panel">
      <header className="flex items-center justify-between border-b border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-default">{title}</h3>
        {typeof count === 'number' && (
          <span className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-muted">{count}</span>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">{label}</span>
      {children}
    </label>
  );
}

export function FormGrid({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

export function ErrorBanner({ message }: { message: string | null }): JSX.Element | null {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-status-error bg-status-error/10 px-3 py-2 text-sm text-status-error">
      {message}
    </div>
  );
}

export function EmptyState({ label }: { label: string }): JSX.Element {
  return <div className="px-3 py-6 text-center text-xs text-muted">{label}</div>;
}

export function RecordList({
  emptyLabel,
  children,
}: {
  emptyLabel: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-subtle">
      {React.Children.count(children) > 0 ? children : <EmptyState label={emptyLabel} />}
    </div>
  );
}

export function RecordButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string | null;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-b border-subtle px-3 py-2.5 text-left last:border-b-0 hover:bg-state-hover"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-default">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
      </div>
    </button>
  );
}

export function makeKey(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return key || `item-${Date.now().toString(36)}`;
}

export function isValidKey(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(value);
}
