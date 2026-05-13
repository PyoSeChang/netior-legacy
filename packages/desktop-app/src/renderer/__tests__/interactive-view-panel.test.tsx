import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SchemaField } from '@netior/shared/types';

const mockInteractiveViewStateService = {
  get: vi.fn(),
  upsert: vi.fn(),
};

const mockInteractiveViewTemplateService = {
  list: vi.fn(),
  getPreference: vi.fn(),
  getSchemaPreference: vi.fn(),
  upsertPreference: vi.fn(),
};

vi.mock('../services', () => ({
  interactiveViewStateService: mockInteractiveViewStateService,
  interactiveViewTemplateService: mockInteractiveViewTemplateService,
}));

const { InteractiveViewPanel } = await import('../components/editor/interactive/InteractiveViewPanel');
const { useEditorStore } = await import('../stores/editor-store');
const { useInstanceStore } = await import('../stores/instance-store');

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

const fields: SchemaField[] = [
  {
    id: 'field-a',
    schema_id: 'schema-1',
    name: 'Alpha',
    field_type: 'text',
    options: null,
    sort_order: 0,
    required: false,
    default_value: null,
    meaning_bindings: [],
    slot_binding_locked: false,
    generated_by_model: false,
    source_kind: 'project',
    source_id: null,
    source_ref: null,
    source_version: null,
    created_at: '',
    bindings: [],
  },
  {
    id: 'field-b',
    schema_id: 'schema-1',
    name: 'Beta',
    field_type: 'textarea',
    options: null,
    sort_order: 1,
    required: false,
    default_value: null,
    meaning_bindings: [],
    slot_binding_locked: false,
    generated_by_model: false,
    source_kind: 'project',
    source_id: null,
    source_ref: null,
    source_version: null,
    created_at: '',
    bindings: [],
  },
];

function renderPanel(overrides?: {
  tabId?: string;
  stateJson?: string | null;
  templates?: Array<{
    id: string;
    name: string;
    source_code: string;
    manifest_json: string;
  }>;
  preferenceTemplateId?: string | null;
  schemaPreferenceTemplateId?: string | null;
  schemaPreferenceError?: Error;
  preferenceMode?: 'inherit' | 'template' | 'none';
  onFieldChange?: (fieldId: string, value: string | null) => void;
  mode?: 'full' | 'view' | 'configure';
}) {
  mockInteractiveViewStateService.get.mockResolvedValue(
    overrides?.stateJson == null
      ? null
      : {
        id: 'state-1',
        project_id: 'project-1',
        instance_id: 'instance-1',
        view_template_id: overrides?.preferenceTemplateId ?? 'template-1',
        state_json: overrides.stateJson,
        created_at: '',
        updated_at: '',
      },
  );
  mockInteractiveViewStateService.upsert.mockResolvedValue({
    id: 'state-1',
    project_id: 'project-1',
    instance_id: 'instance-1',
    view_template_id: overrides?.preferenceTemplateId ?? 'template-1',
    state_json: '{}',
    created_at: '',
    updated_at: '',
  });
  mockInteractiveViewTemplateService.list.mockResolvedValue((overrides?.templates ?? []).map((template) => ({
    project_id: 'project-1',
    target_kind: 'schema',
    target_id: 'schema-1',
    description: null,
    source_kind: 'narre',
    trust_level: 'validated',
    default_runtime: 'sandbox',
    enabled: 1,
    validation_status: 'passed',
    validation_errors_json: '[]',
    created_at: '',
    updated_at: '',
    ...template,
  })));
  mockInteractiveViewTemplateService.getPreference.mockResolvedValue(
    overrides?.preferenceMode || overrides?.preferenceTemplateId
      ? {
        id: 'preference-1',
        project_id: 'project-1',
        instance_id: 'instance-1',
        preference_mode: overrides.preferenceMode ?? 'template',
        selected_view_template_id: overrides.preferenceTemplateId,
        created_at: '',
        updated_at: '',
      }
      : null,
  );
  if (overrides?.schemaPreferenceError) {
    mockInteractiveViewTemplateService.getSchemaPreference.mockRejectedValue(overrides.schemaPreferenceError);
  } else {
    mockInteractiveViewTemplateService.getSchemaPreference.mockResolvedValue(
      overrides?.schemaPreferenceTemplateId
      ? {
        id: 'schema-preference-1',
        project_id: 'project-1',
        schema_id: 'schema-1',
        selected_view_template_id: overrides.schemaPreferenceTemplateId,
        created_at: '',
        updated_at: '',
      }
      : null,
    );
  }
  mockInteractiveViewTemplateService.upsertPreference.mockResolvedValue({
    id: 'preference-1',
    project_id: 'project-1',
    instance_id: 'instance-1',
    preference_mode: 'inherit',
    selected_view_template_id: null,
    created_at: '',
    updated_at: '',
  });

  const onFieldChange = overrides?.onFieldChange ?? vi.fn();
  const rendered = render(
    <InteractiveViewPanel
      tabId={overrides?.tabId}
      projectId="project-1"
      schemaId="schema-1"
      instanceId="instance-1"
      fields={fields}
      properties={{ 'field-a': 'one', 'field-b': 'two' }}
      content={null}
      onFieldChange={onFieldChange}
      mode={overrides?.mode}
    />,
  );
  return { onFieldChange, ...rendered };
}

describe('InteractiveViewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().clear();
    useInstanceStore.setState({ instances: [], loading: false, properties: {} });
  });

  const generatedTemplate = {
    id: 'template-1',
    name: 'Generated layout',
    source_code: `
      import React from 'react';
      import { Button, Stack, useField, useUpdateField, useViewState } from '@netior/interactive-sdk';

      export function View() {
        const { value } = useField('field-a');
        const [count, setCount] = useViewState('count', 0);
        const updateField = useUpdateField();
        return (
          <Stack>
            <div>Alpha value: {value}</div>
            <div>Generated count: {count}</div>
            <Button onClick={() => setCount(count + 1)}>Increment generated</Button>
            <Button onClick={() => updateField('field-a', 'from generated')}>Update generated field</Button>
          </Stack>
        );
      }
    `,
    manifest_json: JSON.stringify({
      kind: 'interactive-view',
      sdkVersion: 1,
      permissions: {
        readFields: ['field-a'],
        writeFields: ['field-a'],
        viewState: true,
      },
      runtime: 'host',
    }),
  };

  it('shows an empty state when no user-authored template is configured', async () => {
    renderPanel();

    await waitFor(() => expect(screen.queryByText('Loading interactive view...')).toBeNull());

    expect(screen.getByText(/No Interactive View configured\.|설정된 인터랙티브 뷰가 없습니다\./)).toBeTruthy();
    expect(mockInteractiveViewStateService.get).not.toHaveBeenCalled();
    expect(mockInteractiveViewStateService.upsert).not.toHaveBeenCalled();
  });

  it('inherits the schema default template when there is no instance override', async () => {
    renderPanel({
      templates: [generatedTemplate],
      schemaPreferenceTemplateId: 'template-1',
      stateJson: JSON.stringify({ count: 4 }),
    });

    await waitFor(() => expect(screen.getAllByText((_content, element) => (
      element?.textContent?.includes('Generated count: 4') ?? false
    )).length).toBeGreaterThan(0));
    expect(screen.getByText(/Use schema default: Generated layout|스키마 기본값 사용: Generated layout/)).toBeTruthy();
  });

  it('continues loading instance-selected templates when schema preference lookup fails', async () => {
    renderPanel({
      templates: [generatedTemplate],
      preferenceTemplateId: 'template-1',
      preferenceMode: 'template',
      stateJson: JSON.stringify({ count: 5 }),
      schemaPreferenceError: new Error('Route not found: GET /interactive-view-schema-preferences'),
    });

    await waitFor(() => expect(screen.getAllByText((_content, element) => (
      element?.textContent?.includes('Generated count: 5') ?? false
    )).length).toBeGreaterThan(0));
    expect(mockInteractiveViewStateService.get).toHaveBeenCalledWith('instance-1', 'template-1');
  });

  it('loads a selected generated template and persists view state changes', async () => {
    renderPanel({
      templates: [generatedTemplate],
      preferenceTemplateId: 'template-1',
      preferenceMode: 'template',
      stateJson: JSON.stringify({ count: 2 }),
    });

    await waitFor(() => expect(screen.getAllByText((_content, element) => (
      element?.textContent?.includes('Generated count: 2') ?? false
    )).length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Increment generated' }));

    await waitFor(() => {
      expect(mockInteractiveViewStateService.upsert).toHaveBeenCalledWith(expect.objectContaining({
        instance_id: 'instance-1',
        view_template_id: 'template-1',
        state_json: expect.stringContaining('"count":3'),
      }));
    });
  });

  it('restores persisted view state after the panel is reopened', async () => {
    const firstRender = renderPanel({
      templates: [generatedTemplate],
      preferenceTemplateId: 'template-1',
      preferenceMode: 'template',
      stateJson: JSON.stringify({ count: 0 }),
    });

    await waitFor(() => expect(screen.getAllByText((_content, element) => (
      element?.textContent?.includes('Generated count: 0') ?? false
    )).length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Increment generated' }));

    let persistedStateJson = '{}';
    await waitFor(() => {
      const stateSaveCall = mockInteractiveViewStateService.upsert.mock.calls.find(([payload]) => (
        payload.instance_id === 'instance-1'
        && payload.view_template_id === 'template-1'
        && String(payload.state_json).includes('"count":1')
      ));
      expect(stateSaveCall).toBeTruthy();
      persistedStateJson = stateSaveCall?.[0].state_json ?? '{}';
    });

    firstRender.unmount();
    renderPanel({
      templates: [generatedTemplate],
      preferenceTemplateId: 'template-1',
      preferenceMode: 'template',
      stateJson: persistedStateJson,
    });

    await waitFor(() => expect(screen.getAllByText((_content, element) => (
      element?.textContent?.includes('Generated count: 1') ?? false
    )).length).toBeGreaterThan(0));
  });

  it('lets generated templates update fields through the SDK', async () => {
    const onFieldChange = vi.fn();
    renderPanel({
      templates: [generatedTemplate],
      preferenceTemplateId: 'template-1',
      preferenceMode: 'template',
      onFieldChange,
    });

    await waitFor(() => expect(screen.queryByText('Loading interactive view...')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Update generated field' }));

    expect(onFieldChange).toHaveBeenCalledWith('field-a', 'from generated');
  });

  it('lets generated templates replace the current object while keeping interactive mode', async () => {
    const navigationTemplate = {
      id: 'template-navigation',
      name: 'Navigation layout',
      source_code: `
        import React from 'react';
        import { Button, Stack, useOpenObject } from '@netior/interactive-sdk';

        export function View() {
          const openObject = useOpenObject();
          return (
            <Stack>
              <Button onClick={() => openObject('instance', 'instance-2', 'Second question')}>Next question</Button>
            </Stack>
          );
        }
      `,
      manifest_json: JSON.stringify({
        kind: 'interactive-view',
        sdkVersion: 1,
        permissions: {
          readFields: [],
          writeFields: [],
          viewState: true,
        },
        runtime: 'host',
      }),
    };

    useEditorStore.setState({
      tabs: [{
        id: 'instance:instance-1',
        type: 'instance',
        targetId: 'instance-1',
        title: 'First question',
        viewMode: 'side',
        hostId: 'main',
        isDirty: false,
        isMinimized: false,
        activeFilePath: null,
        floatRect: { x: 0, y: 0, width: 600, height: 450 },
        sideSplitRatio: 0.5,
      }],
      activeTabId: 'instance:instance-1',
      sideLayout: { type: 'leaf', tabIds: ['instance:instance-1'], activeTabId: 'instance:instance-1' },
      fullLayout: null,
      sideLastActiveTabId: 'instance:instance-1',
      fullLastActiveTabId: null,
      hosts: {},
      focusedHostId: 'main',
    });

    renderPanel({
      tabId: 'instance:instance-1',
      templates: [navigationTemplate],
      preferenceTemplateId: 'template-navigation',
      preferenceMode: 'template',
    });

    await waitFor(() => expect(screen.queryByText('Loading interactive view...')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));

    const state = useEditorStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]).toMatchObject({
      id: 'instance:instance-2',
      type: 'instance',
      targetId: 'instance-2',
      title: 'Second question',
      objectViewMode: 'interactive',
    });
    expect(state.activeTabId).toBe('instance:instance-2');
    expect(state.sideLayout).toMatchObject({
      type: 'leaf',
      tabIds: ['instance:instance-2'],
      activeTabId: 'instance:instance-2',
    });
  });

  it('does not load or autosave view state while rendering configure controls only', async () => {
    renderPanel({
      templates: [generatedTemplate],
      preferenceTemplateId: 'template-1',
      preferenceMode: 'template',
      stateJson: JSON.stringify({ count: 8 }),
      mode: 'configure',
    });

    await waitFor(() => expect(screen.queryByText(/Loading interactive view|인터랙티브 뷰를 불러오는 중/)).toBeNull());

    expect(mockInteractiveViewStateService.get).not.toHaveBeenCalled();
    expect(mockInteractiveViewStateService.upsert).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Increment generated' })).toBeNull();
  });

  it('shows saved templates and persists per-instance template selection', async () => {
    renderPanel({
      templates: [generatedTemplate],
    });

    await waitFor(() => expect(screen.queryByText('Loading interactive view...')).toBeNull());
    expect(screen.getByText(/No Interactive View configured\.|설정된 인터랙티브 뷰가 없습니다\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Generated layout'));

    await waitFor(() => {
      expect(mockInteractiveViewTemplateService.upsertPreference).toHaveBeenCalledWith({
        instance_id: 'instance-1',
        preference_mode: 'template',
        selected_view_template_id: 'template-1',
      });
    });
    expect(screen.getAllByText((_content, element) => (
      element?.textContent?.includes('Generated count: 0') ?? false
    )).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Increment generated' }));
    await waitFor(() => {
      expect(mockInteractiveViewStateService.upsert).toHaveBeenCalledWith(expect.objectContaining({
        instance_id: 'instance-1',
        view_template_id: 'template-1',
        state_json: expect.stringContaining('"count":1'),
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update generated field' }));
    expect(screen.getByText(/Template source and manifest|템플릿 소스와 매니페스트/)).toBeTruthy();
  });
});
