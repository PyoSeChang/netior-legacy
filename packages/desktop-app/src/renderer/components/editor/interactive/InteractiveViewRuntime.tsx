import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SchemaField } from '@netior/shared/types';
import type { NetiorDslExpression, NetiorDslObjectRef, NetiorDslValue } from '@netior/shared/dsl';
import { Button as UiButton } from '../../ui/Button';
import { TextArea } from '../../ui/TextArea';
import { Badge } from '../../ui/Badge';
import { dslService } from '../../../services/dsl-service';
import { useEditorStore } from '../../../stores/editor-store';
import { useInstanceStore } from '../../../stores/instance-store';

interface InteractiveViewContextValue {
  tabId?: string;
  projectId: string;
  schemaId: string;
  instanceId: string;
  fields: SchemaField[];
  properties: Record<string, string | null>;
  content: string | null;
  viewState: Record<string, unknown>;
  setViewStateValue: (key: string, value: unknown) => void;
  updateFieldValue: (fieldKey: string, value: string | null) => void;
  openObject: (objectType: string, refId: string, title?: string) => void;
}

interface InteractiveViewProviderProps {
  tabId?: string;
  projectId: string;
  schemaId: string;
  instanceId: string;
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

export interface CurrentInteractiveInstance {
  id: string;
  projectId: string;
  schemaId: string;
  instanceId: string;
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
  tabId,
  projectId,
  schemaId,
  instanceId,
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

  const openObject = useCallback((objectType: string, refId: string, title?: string) => {
    if (objectType !== 'instance') {
      throw new Error(`Interactive view host cannot open object type yet: ${objectType}`);
    }
    const editorStore = useEditorStore.getState();
    const instanceTitle = useInstanceStore.getState().instances.find((item) => item.id === refId)?.title;
    const tabTitle = title?.trim() || instanceTitle || 'Instance';
    if (tabId) {
      editorStore.navigateTab(tabId, {
        type: 'instance',
        targetId: refId,
        title: tabTitle,
        projectId,
        objectViewMode: 'interactive',
      });
      return;
    }
    void editorStore.openTab({
      type: 'instance',
      targetId: refId,
      title: tabTitle,
      projectId,
      objectViewMode: 'interactive',
    });
  }, [projectId, tabId]);

  const value = useMemo<InteractiveViewContextValue>(() => ({
    tabId,
    projectId,
    schemaId,
    instanceId,
    fields,
    properties,
    content,
    viewState,
    setViewStateValue,
    updateFieldValue,
    openObject,
  }), [content, fields, instanceId, openObject, projectId, properties, schemaId, setViewStateValue, tabId, updateFieldValue, viewState]);

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

export function useFieldValue(fieldKey: string): string | null {
  return useField(fieldKey).value;
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

export function useCurrentInstance(): CurrentInteractiveInstance {
  const { projectId, schemaId, instanceId } = useInteractiveViewContext();
  return { id: instanceId, projectId, schemaId, instanceId };
}

export function useOpenInstance(): (instanceId: string, title?: string) => void {
  const openObject = useOpenObject();
  return useCallback((instanceId: string, title?: string) => {
    openObject('instance', instanceId, title);
  }, [openObject]);
}

export function useOpenObject(): (objectType: string, refId: string, title?: string) => void {
  return useInteractiveViewContext().openObject;
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

export interface InteractiveDslResult<T> {
  value: T | null;
  loading: boolean;
  error: string | null;
}

export type InteractiveDslObjectsResult = NetiorDslObjectRef[] & InteractiveDslResult<NetiorDslObjectRef[]>;

export function useDslValue<T extends NetiorDslValue = NetiorDslValue>(
  expression: NetiorDslExpression,
): InteractiveDslResult<T> {
  const { projectId, schemaId, instanceId, properties, viewState } = useInteractiveViewContext();
  const [state, setState] = useState<InteractiveDslResult<T>>({
    value: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    dslService.evaluate({
      context: {
        projectId,
        currentSchemaId: schemaId,
        currentInstanceId: instanceId,
        currentObject: { objectType: 'instance', refId: instanceId },
        viewState,
        overrides: { properties },
      },
      expression,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setState({ value: result.value as T, loading: false, error: null });
        } else {
          setState({ value: null, loading: false, error: result.error.message });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ value: null, loading: false, error: (error as Error).message });
      });
    return () => { cancelled = true; };
  }, [expression, instanceId, projectId, properties, schemaId, viewState]);

  return state;
}

export function useDslObject(expression: NetiorDslExpression): InteractiveDslResult<NetiorDslObjectRef> {
  const result = useDslValue(expression);
  const value = result.value && typeof result.value === 'object' && !Array.isArray(result.value)
    ? result.value as NetiorDslObjectRef
    : null;
  return {
    value,
    loading: result.loading,
    error: result.error ?? (result.value != null && !value ? 'DSL result is not an object' : null),
  };
}

export function useDslObjects(expression: NetiorDslExpression): InteractiveDslObjectsResult {
  const result = useDslValue(expression);
  const value = Array.isArray(result.value) ? result.value as NetiorDslObjectRef[] : [];
  const objects = [...value] as InteractiveDslObjectsResult;
  objects.value = value;
  objects.loading = result.loading;
  objects.error = result.error ?? (result.value != null && !Array.isArray(result.value) ? 'DSL result is not an object list' : null);
  return objects;
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
