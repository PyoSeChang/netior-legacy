import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { SchemaField } from '@netior/shared/types';
import { Button as UiButton } from '../../ui/Button';
import { TextArea } from '../../ui/TextArea';
import { Badge } from '../../ui/Badge';

interface InteractiveViewContextValue {
  fields: SchemaField[];
  properties: Record<string, string | null>;
  content: string | null;
  viewState: Record<string, unknown>;
  setViewStateValue: (key: string, value: unknown) => void;
  updateFieldValue: (fieldKey: string, value: string | null) => void;
}

interface InteractiveViewProviderProps {
  fields: SchemaField[];
  properties: Record<string, string | null>;
  content: string | null;
  viewState: Record<string, unknown>;
  setViewState: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onFieldChange: (fieldId: string, value: string | null) => void;
  children: React.ReactNode;
}

export interface InteractiveFieldValue {
  field: SchemaField | null;
  value: string | null;
}

const InteractiveViewContext = createContext<InteractiveViewContextValue | null>(null);

function resolveField(fields: SchemaField[], fieldKey: string): SchemaField | null {
  return fields.find((field) => (
    field.id === fieldKey
    || field.source_ref === fieldKey
    || field.name === fieldKey
  )) ?? null;
}

function useInteractiveViewContext(): InteractiveViewContextValue {
  const context = useContext(InteractiveViewContext);
  if (!context) {
    throw new Error('Interactive view SDK hooks must be used inside InteractiveViewProvider.');
  }
  return context;
}

export function InteractiveViewProvider({
  fields,
  properties,
  content,
  viewState,
  setViewState,
  onFieldChange,
  children,
}: InteractiveViewProviderProps): JSX.Element {
  const setViewStateValue = useCallback((key: string, value: unknown) => {
    setViewState((current) => ({ ...current, [key]: value }));
  }, [setViewState]);

  const updateFieldValue = useCallback((fieldKey: string, value: string | null) => {
    const field = resolveField(fields, fieldKey);
    if (!field) return;
    onFieldChange(field.id, value);
  }, [fields, onFieldChange]);

  const value = useMemo<InteractiveViewContextValue>(() => ({
    fields,
    properties,
    content,
    viewState,
    setViewStateValue,
    updateFieldValue,
  }), [content, fields, properties, setViewStateValue, updateFieldValue, viewState]);

  return (
    <InteractiveViewContext.Provider value={value}>
      {children}
    </InteractiveViewContext.Provider>
  );
}

export function useField(fieldKey: string): InteractiveFieldValue {
  const { fields, properties } = useInteractiveViewContext();
  const field = useMemo(() => resolveField(fields, fieldKey), [fields, fieldKey]);
  return {
    field,
    value: field ? properties[field.id] ?? null : null,
  };
}

export function useFields(): InteractiveFieldValue[] {
  const { fields, properties } = useInteractiveViewContext();
  return useMemo(() => fields.map((field) => ({
    field,
    value: properties[field.id] ?? null,
  })), [fields, properties]);
}

export function useContent(): string | null {
  return useInteractiveViewContext().content;
}

export function useUpdateField(): (fieldKey: string, value: string | null) => void {
  return useInteractiveViewContext().updateFieldValue;
}

export function useViewState<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const { viewState, setViewStateValue } = useInteractiveViewContext();
  const value = Object.prototype.hasOwnProperty.call(viewState, key)
    ? viewState[key] as T
    : initialValue;

  const setValue = useCallback((nextValue: T) => {
    setViewStateValue(key, nextValue);
  }, [key, setViewStateValue]);

  return [value, setValue];
}

export function Stack({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function Inline({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function Panel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg border border-subtle bg-surface-card p-3">
      {children}
    </div>
  );
}

export function Button(props: React.ComponentProps<typeof UiButton>): JSX.Element {
  return <UiButton {...props} />;
}

export function Field({ name }: { name: string }): JSX.Element {
  const { field, value } = useField(name);
  if (!field) {
    return (
      <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-2 text-xs text-muted">
        Field not found: {name}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="truncate text-xs font-medium text-secondary">{field.name}</div>
        <Badge>{field.field_type}</Badge>
      </div>
      <div className="whitespace-pre-wrap break-words text-sm text-default">
        {value?.trim() ? value : <span className="text-muted">Empty</span>}
      </div>
    </div>
  );
}

export function FieldEditor({
  fieldKey,
  draft,
  onDraftChange,
  onSave,
}: {
  fieldKey: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
}): JSX.Element {
  const { field } = useField(fieldKey);
  return (
    <div className="flex flex-col gap-2">
      <TextArea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        rows={4}
        placeholder={field ? `Edit ${field.name}` : 'Select a field'}
        disabled={!field}
      />
      <div className="flex justify-end">
        <UiButton type="button" size="sm" disabled={!field} onClick={onSave}>
          Save field
        </UiButton>
      </div>
    </div>
  );
}
