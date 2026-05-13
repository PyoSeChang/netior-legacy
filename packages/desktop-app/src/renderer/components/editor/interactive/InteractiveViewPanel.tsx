import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InteractiveViewTemplate, SchemaField } from '@netior/shared/types';
import { interactiveViewStateService, interactiveViewTemplateService } from '../../../services';
import { validateInteractiveViewSource } from '../../../lib/interactive-view-validator';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { TextArea } from '../../ui/TextArea';
import { InteractiveViewProvider } from './InteractiveViewRuntime';
import { DynamicInteractiveView } from './DynamicInteractiveView';
import { useI18n } from '../../../hooks/useI18n';

const SAVE_DEBOUNCE_MS = 300;
const INHERIT_TEMPLATE_OPTION = '__inherit_schema_template__';
const NO_TEMPLATE_OPTION = '__no_interactive_view__';
const INTERACTIVE_VIEW_SELECTION_EVENT = 'netior:interactive-view-selection-changed';

interface InteractiveViewPanelProps {
  tabId?: string;
  projectId: string;
  schemaId: string;
  instanceId: string;
  fields: SchemaField[];
  properties: Record<string, string | null>;
  content: string | null;
  onFieldChange: (fieldId: string, value: string | null) => void;
  mode?: 'full' | 'view' | 'configure';
}

export function InteractiveViewPanel({
  tabId,
  projectId,
  schemaId,
  instanceId,
  fields,
  properties,
  content,
  onFieldChange,
  mode = 'full',
}: InteractiveViewPanelProps): JSX.Element {
  const { t } = useI18n();
  const [viewState, setViewState] = useState<Record<string, unknown>>({});
  const [templates, setTemplates] = useState<InteractiveViewTemplate[]>([]);
  const [effectiveTemplateId, setEffectiveTemplateId] = useState<string | null>(null);
  const [selectionValue, setSelectionValue] = useState(INHERIT_TEMPLATE_OPTION);
  const [schemaDefaultTemplateId, setSchemaDefaultTemplateId] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelIdRef = useRef(`interactive-view-panel-${Math.random().toString(36).slice(2)}`);

  const loadTemplateSelection = useCallback(() => {
    let ignore = false;
    setIsLoadingTemplates(true);

    Promise.all([
      interactiveViewTemplateService.list({ projectId, schemaId, instanceId }),
      interactiveViewTemplateService.getPreference(instanceId),
      interactiveViewTemplateService.getSchemaPreference(schemaId).catch(() => null),
    ])
      .then(([nextTemplates, preference, schemaPreference]) => {
        if (ignore) return;
        setTemplates(nextTemplates);
        const availableIds = new Set(nextTemplates.map((template) => template.id));
        const inheritedTemplateId = schemaPreference?.selected_view_template_id;
        const validInheritedTemplateId = inheritedTemplateId && availableIds.has(inheritedTemplateId)
          ? inheritedTemplateId
          : null;
        setSchemaDefaultTemplateId(validInheritedTemplateId);

        if (preference?.preference_mode === 'template') {
          const overrideTemplateId = preference.selected_view_template_id;
          const validOverrideTemplateId = overrideTemplateId && availableIds.has(overrideTemplateId)
            ? overrideTemplateId
            : null;
          setSelectionValue(validOverrideTemplateId ?? INHERIT_TEMPLATE_OPTION);
          setEffectiveTemplateId(validOverrideTemplateId ?? validInheritedTemplateId);
          return;
        }

        if (preference?.preference_mode === 'none') {
          setSelectionValue(NO_TEMPLATE_OPTION);
          setEffectiveTemplateId(null);
          return;
        }

        setSelectionValue(INHERIT_TEMPLATE_OPTION);
        setEffectiveTemplateId(validInheritedTemplateId);
      })
      .finally(() => {
        if (ignore) return;
        setIsLoadingTemplates(false);
      });

    return () => {
      ignore = true;
    };
  }, [instanceId, projectId, schemaId]);

  useEffect(() => loadTemplateSelection(), [loadTemplateSelection]);

  useEffect(() => {
    const handleSelectionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ instanceId?: string; schemaId?: string; sourceId?: string }>).detail;
      if (detail?.sourceId === panelIdRef.current) return;
      if (detail?.instanceId !== instanceId && detail?.schemaId !== schemaId) return;
      loadTemplateSelection();
    };
    window.addEventListener(INTERACTIVE_VIEW_SELECTION_EVENT, handleSelectionChanged);
    return () => {
      window.removeEventListener(INTERACTIVE_VIEW_SELECTION_EVENT, handleSelectionChanged);
    };
  }, [instanceId, loadTemplateSelection, schemaId]);

  useEffect(() => {
    let ignore = false;
    loadedRef.current = false;
    setIsLoadingState(mode === 'configure' ? false : true);
    setViewState({});

    if (mode === 'configure') {
      return () => {
        ignore = true;
      };
    }

    if (!effectiveTemplateId) {
      setIsLoadingState(false);
      return () => {
        ignore = true;
      };
    }

    interactiveViewStateService.get(instanceId, effectiveTemplateId)
      .then((record) => {
        if (ignore) return;
        if (!record?.state_json) {
          setViewState({});
          return;
        }
        try {
          const parsed = JSON.parse(record.state_json) as unknown;
          setViewState(parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : {});
        } catch {
          setViewState({});
        }
      })
      .finally(() => {
        if (ignore) return;
        loadedRef.current = true;
        setIsLoadingState(false);
      });

    return () => {
      ignore = true;
    };
  }, [effectiveTemplateId, instanceId, mode]);

  useEffect(() => {
    if (mode === 'configure') return;
    if (!effectiveTemplateId) return;
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void interactiveViewStateService.upsert({
        instance_id: instanceId,
        view_template_id: effectiveTemplateId,
        state_json: JSON.stringify(viewState),
      });
      saveTimerRef.current = null;
    }, SAVE_DEBOUNCE_MS);
  }, [effectiveTemplateId, instanceId, mode, viewState]);

  const selectedTemplate = effectiveTemplateId
    ? templates.find((template) => template.id === effectiveTemplateId) ?? null
    : null;
  const selectedTemplateValidation = useMemo(() => (
    selectedTemplate
      ? validateInteractiveViewSource(selectedTemplate.source_code, selectedTemplate.manifest_json)
      : null
  ), [selectedTemplate]);
  const inheritedTemplate = templates.find((template) => (
    template.id === schemaDefaultTemplateId
  ));
  const templateOptions = [
    {
      value: INHERIT_TEMPLATE_OPTION,
      label: inheritedTemplate
        ? t('interactiveView.useSchemaDefaultNamed' as never, { name: inheritedTemplate.name })
        : t('interactiveView.useSchemaDefault' as never),
    },
    { value: NO_TEMPLATE_OPTION, label: t('interactiveView.noInteractiveView' as never) },
    ...templates.map((template) => ({ value: template.id, label: template.name })),
  ];

  const handleTemplateChange = (nextTemplateId: string) => {
    setSelectionValue(nextTemplateId);

    if (nextTemplateId === INHERIT_TEMPLATE_OPTION) {
      setEffectiveTemplateId(schemaDefaultTemplateId);
      void interactiveViewTemplateService.upsertPreference({
        instance_id: instanceId,
        preference_mode: 'inherit',
        selected_view_template_id: null,
      }).then(() => {
        window.dispatchEvent(new CustomEvent(INTERACTIVE_VIEW_SELECTION_EVENT, {
          detail: { instanceId, schemaId, sourceId: panelIdRef.current },
        }));
      });
      return;
    }

    if (nextTemplateId === NO_TEMPLATE_OPTION) {
      setEffectiveTemplateId(null);
      void interactiveViewTemplateService.upsertPreference({
        instance_id: instanceId,
        preference_mode: 'none',
        selected_view_template_id: null,
      }).then(() => {
        window.dispatchEvent(new CustomEvent(INTERACTIVE_VIEW_SELECTION_EVENT, {
          detail: { instanceId, schemaId, sourceId: panelIdRef.current },
        }));
      });
      return;
    }

    setEffectiveTemplateId(nextTemplateId);
    void interactiveViewTemplateService.upsertPreference({
      instance_id: instanceId,
      preference_mode: 'template',
      selected_view_template_id: nextTemplateId,
    }).then(() => {
      window.dispatchEvent(new CustomEvent(INTERACTIVE_VIEW_SELECTION_EVENT, {
        detail: { instanceId, schemaId, sourceId: panelIdRef.current },
      }));
    });
  };

  const resetViewState = () => {
    if (!effectiveTemplateId) return;
    loadedRef.current = true;
    setViewState({});
    void interactiveViewStateService.upsert({
      instance_id: instanceId,
      view_template_id: effectiveTemplateId,
      state_json: '{}',
    });
  };

  if (isLoadingTemplates || isLoadingState) {
    return (
      <div className="rounded-lg border border-subtle bg-surface-card px-3 py-2 text-sm text-secondary">
        {t('interactiveView.loading' as never)}
      </div>
    );
  }

  const configureContent = (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-secondary">{t('interactiveView.viewTemplate' as never)}</label>
            <Select
              options={templateOptions}
              value={selectionValue}
              onChange={(event) => handleTemplateChange(event.target.value)}
              selectSize="sm"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={resetViewState} disabled={!effectiveTemplateId}>
            {t('interactiveView.resetState' as never)}
          </Button>
        </div>
        <div className="text-[11px] text-muted">
          {selectedTemplate?.description ?? t('interactiveView.noTemplateSelected' as never)}
        </div>
      </div>

      {selectedTemplate && selectedTemplateValidation && (
        <details className="rounded-lg border border-subtle bg-surface-card p-3">
          <summary className="cursor-pointer text-xs font-medium text-secondary">
            {t('interactiveView.templateSourceAndManifest' as never)}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid gap-2 text-xs text-secondary sm:grid-cols-3">
              <div>{t('interactiveView.runtime' as never)}: {selectedTemplateValidation.runtime}</div>
              <div>{t('interactiveView.trust' as never)}: {selectedTemplate.trust_level}</div>
              <div>
                {t('interactiveView.validation' as never)}: {selectedTemplateValidation.ok
                  ? t('interactiveView.validationPassed' as never)
                  : t('interactiveView.validationFailedStatus' as never)}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('interactiveView.manifest' as never)}</label>
              <TextArea value={selectedTemplate.manifest_json} readOnly rows={6} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('interactiveView.source' as never)}</label>
              <TextArea value={selectedTemplate.source_code} readOnly rows={12} />
            </div>
          </div>
        </details>
      )}
    </>
  );

  const viewContent = !selectedTemplate ? (
    <div className="rounded-lg border border-subtle bg-surface-card px-3 py-2 text-sm text-secondary">
      {t('interactiveView.notConfigured' as never)}
    </div>
  ) : !selectedTemplateValidation?.ok ? (
    <div className="flex flex-col gap-2 rounded-lg border border-status-error bg-surface-card p-3">
      <div className="text-sm font-medium text-status-error">{t('interactiveView.validationFailed' as never)}</div>
      <div className="flex flex-col gap-1 text-xs text-muted">
        {selectedTemplateValidation?.issues.map((issue) => (
          <div key={`${issue.code}:${issue.message}`}>
            {issue.code}: {issue.message}
          </div>
        ))}
      </div>
    </div>
  ) : (
    <InteractiveViewProvider
      tabId={tabId}
      projectId={projectId}
      schemaId={schemaId}
      instanceId={instanceId}
      fields={fields}
      properties={properties}
      content={content}
      viewState={viewState}
      setViewState={setViewState}
      onFieldChange={onFieldChange}
    >
      <DynamicInteractiveView sourceCode={selectedTemplate.source_code} />
    </InteractiveViewProvider>
  );

  return (
    <div className="flex flex-col gap-3">
      {mode !== 'view' && configureContent}
      {mode !== 'configure' && viewContent}
    </div>
  );
}
