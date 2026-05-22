import React, { useCallback, useEffect, useState, useMemo } from 'react';
import type {
  EditorTab,
  FieldMeaningBindingKey,
  NodeConfig,
  NodeSortConfig,
  NodeType,
} from '@netior/shared/types';
import { MEANING_SLOT_DEFINITIONS, getMeaningSlotLabelKey, fieldMeaningToMeaningBindings } from '@netior/shared/constants';
import { instancePropertyService, networkService, objectService } from '../../services';
import type { NetworkFullData } from '../../services/network-service';
import { useInstanceStore } from '../../stores/instance-store';
import { useSchemaStore } from '../../stores/schema-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { ScrollArea } from '../ui/ScrollArea';
import { Select } from '../ui/Select';
import { RadioGroup } from '../ui/RadioGroup';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { FilePicker } from '../ui/FilePicker';
import { IconSelector } from '../ui/IconSelector';
import { InstancePropertiesPanel, InstancePropertyInputs } from './InstancePropertiesPanel';
import { InstanceBodyEditor } from './InstanceBodyEditor';
import { InstanceAgentView } from './InstanceAgentView';
import { InteractiveViewPanel } from './interactive/InteractiveViewPanel';
import { useI18n } from '../../hooks/useI18n';
import {
  CONTAINS_MODEL_KEY,
  HIERARCHY_PARENT_MODEL_KEY,
  isContainsEdge,
  systemEdgeModelId,
} from '../../lib/edge-models';
import { isImageSourceValue } from '../workspace/node-components/node-visual-utils';
import { NodeVisual } from '../workspace/node-components/NodeVisual';
import {
  createDefaultNodeConfig,
  extractNodeConfig,
  parseNodeMetadataObject,
  stringifyNodeMetadataObject,
  upsertNodeConfigMetadata,
} from '../../lib/node-config';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';

interface InstanceEditorProps {
  tab: EditorTab;
}

interface InstanceEditorState {
  title: string;
  modelId: string | null;
  icon: string | null;
  color: string | null;
  content: string | null;
  properties: Record<string, string | null>;
  nodeOccurrences: InstanceNodeOccurrenceDraft[];
}

interface InstanceNodeOccurrenceDraft {
  nodeId: string;
  networkId: string;
  networkName: string;
  nodeType: NodeType;
  metadata: string;
}

type OccurrenceNetworkData = Pick<NetworkFullData, 'nodes' | 'edges'>;

const DEPRECATED_NODE_IMAGE_METADATA_KEYS = [
  'imageUrl',
  'image_url',
  'avatarUrl',
  'avatar_url',
  'profileImageUrl',
  'profile_image_url',
] as const;

const IMAGE_FILE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
] as const;

const isDraftTab = (tab: EditorTab) => tab.targetId.startsWith('draft-') && tab.draftData !== undefined;

type VisualMode = 'icon' | 'image';

function stripLegacyNodeImageMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata };

  for (const key of DEPRECATED_NODE_IMAGE_METADATA_KEYS) {
    delete next[key];
  }

  return next;
}

function createNodeConfigDraft(kind: NodeConfig['kind'], previousSort?: NodeSortConfig | null): NodeConfig {
  const base = createDefaultNodeConfig(kind);
  if (base.kind === 'freeform') return base;
  return { ...base, sort: previousSort ?? null };
}

function createSortConfigDraft(kind: NodeSortConfig['kind'], fallbackFieldId?: string): NodeSortConfig | null {
  if (kind === 'meaning_binding') {
    return {
      kind: 'meaning_binding',
      meaning: 'structure.order',
      direction: 'asc',
      emptyPlacement: 'last',
    };
  }

  if (kind === 'property' && fallbackFieldId) {
    return {
      kind: 'property',
      fieldId: fallbackFieldId,
      direction: 'asc',
      emptyPlacement: 'last',
    };
  }

  return null;
}

function isSortableNodeConfig(nodeConfig: NodeConfig | null | undefined): nodeConfig is Extract<NodeConfig, { kind: 'grid' | 'list' }> {
  return !!nodeConfig && nodeConfig.kind !== 'freeform';
}

function resolvePreferredNodeId(
  occurrences: InstanceNodeOccurrenceDraft[],
  preferredNodeId?: string,
  preferredNetworkId?: string,
): string {
  if (preferredNodeId && occurrences.some((item) => item.nodeId === preferredNodeId)) {
    return preferredNodeId;
  }

  if (preferredNetworkId) {
    const nodeInNetwork = occurrences.find((item) => item.networkId === preferredNetworkId);
    if (nodeInNetwork) return nodeInNetwork.nodeId;
  }

  return occurrences[0]?.nodeId ?? '';
}

async function loadInstanceNodeOccurrences(
  projectId: string,
  instanceId: string,
): Promise<Pick<InstanceEditorState, 'nodeOccurrences'>> {
  const networks = await networkService.list(projectId);
  const items = await Promise.all(networks.map(async (network) => ({
    network,
    full: await networkService.getFull(network.id),
  })));

  const nodeOccurrences = items.flatMap(({ network, full }) => (
    full?.nodes
      .filter((node) => node.object?.object_type === 'instance' && node.object.ref_id === instanceId)
      .map((node) => {
        const parsedMetadata = parseNodeMetadataObject(node.metadata);
        const sanitizedMetadata = parsedMetadata ? stripLegacyNodeImageMetadata(parsedMetadata) : null;
        return {
          nodeId: node.id,
          networkId: network.id,
          networkName: network.name,
          nodeType: node.node_type,
          metadata: sanitizedMetadata ? stringifyNodeMetadataObject(sanitizedMetadata) : (node.metadata ?? ''),
        } satisfies InstanceNodeOccurrenceDraft;
      }) ?? []
  ));

  return {
    nodeOccurrences,
  };
}

function resolveVisualMode(value: string | null | undefined): VisualMode {
  return isImageSourceValue(value) ? 'image' : 'icon';
}

function isDateOnlyValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function subtractOccurrenceBoundary(value: string, isAllDay: boolean): string | null {
  if (isAllDay || isDateOnlyValue(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setDate(parsed.getDate() - 1);
    return formatDateOnly(parsed);
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setMinutes(parsed.getMinutes() - 1);

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return parsed.toISOString().slice(0, 16) + 'Z';
  }

  return formatLocalDateTime(parsed);
}

function areInstancePropertiesEqual(
  a: Record<string, string | null>,
  b: Record<string, string | null>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function areNodeOccurrencesEqual(
  a: InstanceNodeOccurrenceDraft[],
  b: InstanceNodeOccurrenceDraft[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return other
      && item.nodeId === other.nodeId
      && item.networkId === other.networkId
      && item.networkName === other.networkName
      && item.nodeType === other.nodeType
      && item.metadata === other.metadata;
  });
}

function areInstanceEditorStatesEqual(a: InstanceEditorState, b: InstanceEditorState): boolean {
  return a.title === b.title
    && a.modelId === b.modelId
    && a.icon === b.icon
    && a.color === b.color
    && a.content === b.content
    && areInstancePropertiesEqual(a.properties, b.properties)
    && areNodeOccurrencesEqual(a.nodeOccurrences, b.nodeOccurrences);
}

export function InstanceEditor({ tab }: InstanceEditorProps): JSX.Element {
  const { t } = useI18n();
  const isDraft = isDraftTab(tab);
  const currentProject = useProjectStore((s) => s.currentProject);
  const instances = useInstanceStore((s) => s.instances);
  const {
    createInstance,
    updateInstance,
    deleteInstance,
    loadByProject: loadInstancesByProject,
    upsertProperty,
    deleteProperty: deleteInstanceProperty,
  } = useInstanceStore();
  const models = useSchemaStore((s) => Array.isArray(s.schemas) ? s.schemas : []);
  const fields = useSchemaStore((s) => s.fields);
  const loadSchemasByProject = useSchemaStore((s) => s.loadByProject);
  const loadFields = useSchemaStore((s) => s.loadFields);
  const createField = useSchemaStore((s) => s.createField);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const currentNetworkNodes = useNetworkStore((s) => s.nodes);
  const currentNetworkEdges = useNetworkStore((s) => s.edges);
  const { addNode, openNetwork, setNodePosition } = useNetworkStore();
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedOccurrenceNetworkData, setSelectedOccurrenceNetworkData] = useState<OccurrenceNetworkData | null>(null);
  const [instanceVisualMode, setInstanceVisualMode] = useState<VisualMode>('icon');

  const instance = isDraft ? undefined : instances.find((c) => c.id === tab.targetId);
  const nodeTypeOptions = useMemo<Array<{ value: NodeType; label: string }>>(() => ([
    { value: 'basic', label: t('instance.nodeRoleOptions.basic' as never) },
    { value: 'portal', label: t('instance.nodeRoleOptions.portal' as never) },
    { value: 'group', label: t('instance.nodeRoleOptions.group' as never) },
    { value: 'hierarchy', label: t('instance.nodeRoleOptions.hierarchy' as never) },
  ]), [t]);
  const instanceVisualModeOptions = useMemo(() => ([
    { value: 'icon', label: t('instance.visualModeOptions.icon' as never) },
    { value: 'image', label: t('instance.visualModeOptions.image' as never) },
  ]), [t]);

  const syncInstanceProperties = useCallback(async (
    instanceId: string,
    schemaId: string | null,
    nextProperties: Record<string, string | null>,
  ) => {
    const existingProperties = await instancePropertyService.getByInstance(instanceId);
    let validFieldIds = new Set<string>();
    if (schemaId) {
      let schemaFields = useSchemaStore.getState().fields[schemaId] ?? [];
      if (schemaFields.length === 0) {
        await useSchemaStore.getState().loadFields(schemaId);
        schemaFields = useSchemaStore.getState().fields[schemaId] ?? [];
      }
      validFieldIds = new Set(schemaFields.map((field) => field.id));
    }
    const nextPropertyMap = new Map(Object.entries(nextProperties));

    await Promise.all(
      existingProperties
        .filter((property) => (
          !validFieldIds.has(property.field_id)
          || !nextPropertyMap.has(property.field_id)
          || nextPropertyMap.get(property.field_id) == null
        ))
        .map((property) => deleteInstanceProperty(property.id, instanceId)),
    );

    await Promise.all(
      Object.entries(nextProperties)
        .filter(([fieldId, value]) => value != null && validFieldIds.has(fieldId))
        .map(([fieldId, value]) => upsertProperty({ instance_id: instanceId, field_id: fieldId, value })),
    );
  }, [deleteInstanceProperty, upsertProperty]);

  const maybePromoteOccurrenceToSeries = useCallback(async (
    instanceId: string,
    state: InstanceEditorState,
  ) => {
    const liveInstance = useInstanceStore.getState().instances.find((item) => item.id === instanceId);
    if (!liveInstance?.recurrence_source_instance_id || !state.modelId) return;

    const activeFields = useSchemaStore.getState().fields[state.modelId] ?? [];
    const recurrenceFrequencyField = activeFields.find((field) => getFieldMeaningSlot(field) === 'recurrence_frequency');
    const fallbackRecurrenceRuleField = activeFields.find((field) => getFieldMeaningSlot(field) === 'recurrence_rule');
    const startAtField = activeFields.find((field) => getFieldMeaningSlot(field) === 'start_at');
    const allDayField = activeFields.find((field) => getFieldMeaningSlot(field) === 'all_day');

    const recurrenceFrequency = recurrenceFrequencyField ? state.properties[recurrenceFrequencyField.id]?.trim() : '';
    const fallbackRecurrenceRule = fallbackRecurrenceRuleField ? state.properties[fallbackRecurrenceRuleField.id]?.trim() : '';
    const startAtValue = startAtField ? state.properties[startAtField.id] : null;
    const isAllDay = allDayField ? state.properties[allDayField.id] === 'true' : false;

    if ((!recurrenceFrequency && !fallbackRecurrenceRule) || !startAtValue) return;

    let recurrenceUntilField = activeFields.find((field) => getFieldMeaningSlot(field) === 'recurrence_until');
    if (!recurrenceUntilField) {
      recurrenceUntilField = await createField({
        schema_id: state.modelId,
        name: t(getMeaningSlotLabelKey('recurrence_until') as never),
        field_type: startAtField?.field_type === 'datetime' && !isAllDay ? 'datetime' : 'date',
        sort_order: activeFields.length,
        required: false,
        meaning_slot: 'recurrence_until',
        meaning_key: 'time.recurrence_until',
        meaning_bindings: fieldMeaningToMeaningBindings('time.recurrence_until'),
        slot_binding_locked: true,
        generated_by_model: true,
      });
    }

    const previousBoundary = subtractOccurrenceBoundary(startAtValue, isAllDay);
    if (!previousBoundary) return;

    await upsertProperty({
      instance_id: liveInstance.recurrence_source_instance_id,
      field_id: recurrenceUntilField.id,
      value: previousBoundary,
    });

    await updateInstance(instanceId, {
      recurrence_source_instance_id: null,
      recurrence_occurrence_key: null,
    });
  }, [createField, t, updateInstance, upsertProperty]);

  useEffect(() => {
    if (!isDraft && !instance && currentProject) {
      loadInstancesByProject(currentProject.id);
    }
  }, [isDraft, instance, currentProject, loadInstancesByProject]);

  useEffect(() => {
    if (currentProject) {
      void loadSchemasByProject(currentProject.id);
    }
  }, [currentProject, loadSchemasByProject]);

  const session = useEditorSession<InstanceEditorState>({
    tabId: tab.id,
    load: isDraft
      ? () => ({
          title: tab.title,
          modelId: null,
          icon: null,
          color: null,
          content: null,
          properties: {},
          nodeOccurrences: [],
        })
      : async () => {
          const c = useInstanceStore.getState().instances.find((cc) => cc.id === tab.targetId);
          const props = await instancePropertyService.getByInstance(tab.targetId);
          const propsMap: Record<string, string | null> = {};
          for (const p of props) {
            propsMap[p.field_id] = p.value;
          }
          const occurrenceState = currentProject
            ? await loadInstanceNodeOccurrences(currentProject.id, tab.targetId)
            : { nodeOccurrences: [] };
          return {
            title: c?.title ?? '',
            modelId: c?.schema_id ?? null,
            icon: c?.icon ?? null,
            color: c?.color ?? null,
            content: c?.content ?? null,
            properties: propsMap,
            nodeOccurrences: occurrenceState.nodeOccurrences,
          };
        },
    save: isDraft
      ? async (state) => {
          if (!currentProject || !state.title.trim()) return;
          const draft = tab.draftData;
          const newInstance = await createInstance({
            project_id: currentProject.id,
            title: state.title.trim(),
            schema_id: state.modelId || undefined,
            icon: state.icon || undefined,
            color: state.color || undefined,
            content: state.content || undefined,
          });
          await syncInstanceProperties(newInstance.id, state.modelId, state.properties);
          if (draft?.networkId) {
            const instanceObj = await objectService.getByRef('instance', newInstance.id);
            if (instanceObj) {
              const node = await addNode({
                network_id: draft.networkId,
                object_id: instanceObj.id,
              });
              const parentGroupNode = draft.parentGroupNodeId
                ? useNetworkStore.getState().nodes.find((item) => item.id === draft.parentGroupNodeId)
                : undefined;
              if (draft.parentGroupNodeId) {
                await networkService.edge.create({
                  network_id: draft.networkId,
                  source_node_id: draft.parentGroupNodeId,
                  target_node_id: node.id,
                  model_id: systemEdgeModelId(currentProject.id, CONTAINS_MODEL_KEY),
                });
                if (parentGroupNode?.node_type === 'hierarchy') {
                  await networkService.edge.create({
                    network_id: draft.networkId,
                    source_node_id: draft.parentGroupNodeId,
                    target_node_id: node.id,
                    model_id: systemEdgeModelId(currentProject.id, HIERARCHY_PARENT_MODEL_KEY),
                  });
                }
              }
              const positionX = typeof draft.positionX === 'number' ? draft.positionX : 0;
              const positionY = typeof draft.positionY === 'number' ? draft.positionY : 0;
              const positionPayload: Record<string, number> = { x: positionX, y: positionY };
              if (typeof draft.slotIndex === 'number') {
                positionPayload.slotIndex = draft.slotIndex;
              }
              await setNodePosition(node.id, JSON.stringify(positionPayload));
            }
            await openNetwork(draft.networkId);
            const networkStore = useNetworkStore.getState();
            if (networkStore.currentNetwork?.project_id) {
              await networkStore.loadNetworkTree(networkStore.currentNetwork.project_id);
            }
          }
          const editorStore = useEditorStore.getState();
          editorStore.closeTab(tab.id);
          editorStore.openTab({
            type: 'instance',
            targetId: newInstance.id,
            title: newInstance.title,
          });
        }
      : async (state) => {
          const instanceId = tab.targetId;
          await updateInstance(instanceId, {
            title: state.title,
            schema_id: state.modelId,
            icon: state.icon,
            color: state.color,
            content: state.content,
          });
          await syncInstanceProperties(instanceId, state.modelId, state.properties);
          await maybePromoteOccurrenceToSeries(instanceId, state);
          await Promise.all(state.nodeOccurrences.map(async (occurrence) => {
            const nextMetadata = occurrence.metadata.trim() ? occurrence.metadata : null;
            if (currentNetwork?.id === occurrence.networkId) {
              await useNetworkStore.getState().updateNode(occurrence.nodeId, {
                node_type: occurrence.nodeType,
                metadata: nextMetadata,
              });
              return;
            }

            await networkService.node.update(occurrence.nodeId, {
              node_type: occurrence.nodeType,
              metadata: nextMetadata,
            });
          }));
          useEditorStore.getState().updateTitle(tab.id, state.title);
        },
    isEqual: areInstanceEditorStatesEqual,
    deps: isDraft ? [] : [tab.targetId, instance?.schema_id, currentProject?.id],
  });

  useEffect(() => {
    if (session.isLoading) return;
    setInstanceVisualMode(resolveVisualMode(session.state?.icon));
  }, [session.isLoading, session.state?.icon]);

  const currentModelId = session.state?.modelId;
  useEffect(() => {
    if (currentModelId && !fields[currentModelId]) {
      loadFields(currentModelId);
    }
  }, [currentModelId, fields, loadFields]);

  useEffect(() => {
    if (!isDraft || !currentModelId) return;
    const arch = models.find((a) => a.id === currentModelId);
    if (arch) {
      session.setState((prev) => ({
        ...prev,
        icon: prev.icon || arch.icon || null,
        color: prev.color || arch.color || null,
      }));
    }
  }, [isDraft, currentModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allowedIds = tab.draftData?.allowedModelIds;
  const filteredModels = allowedIds
    ? models.filter((a) => allowedIds.includes(a.id))
    : models;

  useEffect(() => {
    if (isDraft && allowedIds && !currentModelId && filteredModels.length > 0) {
      session.setState((prev) => ({ ...prev, modelId: filteredModels[0].id }));
    }
  }, [isDraft, allowedIds, currentModelId, filteredModels]); // eslint-disable-line react-hooks/exhaustive-deps

  const modelOptions = useMemo(() => [
    ...(allowedIds ? [] : [{ value: '', label: t('common.none') ?? 'None' }]),
    ...filteredModels.map((a) => ({ value: a.id, label: a.name })),
  ], [filteredModels, allowedIds, t]);

  const modelFields = currentModelId
      ? (fields[currentModelId] ?? []).filter((field) => getFieldMeaningSlot(field) !== 'recurrence_rule')
    : [];

  const nodeOccurrences = session.state?.nodeOccurrences ?? [];
  const selectedNodeOccurrence = useMemo(
    () => nodeOccurrences.find((item) => item.nodeId === selectedNodeId),
    [nodeOccurrences, selectedNodeId],
  );

  useEffect(() => {
    setSelectedNodeId((current) => {
      if (current && nodeOccurrences.some((item) => item.nodeId === current)) return current;
      return resolvePreferredNodeId(nodeOccurrences, tab.nodeId, tab.networkId);
    });
  }, [nodeOccurrences, tab.networkId, tab.nodeId]);

  useEffect(() => {
    if (!selectedNodeOccurrence) {
      setSelectedOccurrenceNetworkData(null);
      return;
    }

    if (currentNetwork?.id === selectedNodeOccurrence.networkId) {
      setSelectedOccurrenceNetworkData({
        nodes: currentNetworkNodes,
        edges: currentNetworkEdges,
      });
      return;
    }

    let ignore = false;
    networkService.getFull(selectedNodeOccurrence.networkId).then((full) => {
      if (ignore) return;
      setSelectedOccurrenceNetworkData(full ? { nodes: full.nodes, edges: full.edges } : null);
    });
    return () => { ignore = true; };
  }, [currentNetwork?.id, currentNetworkEdges, currentNetworkNodes, selectedNodeOccurrence]);

  const selectedNodeMetadataDraft = selectedNodeOccurrence?.metadata ?? '';
  const parsedNodeMetadataDraft = useMemo(
    () => parseNodeMetadataObject(selectedNodeMetadataDraft),
    [selectedNodeMetadataDraft],
  );

  const selectedNodeConfig = useMemo(
    () => extractNodeConfig(parsedNodeMetadataDraft),
    [parsedNodeMetadataDraft],
  );

  const isGroupNodeOccurrence = selectedNodeOccurrence?.nodeType === 'group';

  const directChildIds = useMemo(() => {
    if (!selectedOccurrenceNetworkData || !selectedNodeOccurrence) return new Set<string>();
    return new Set(
      selectedOccurrenceNetworkData.edges
        .filter((edge) => isContainsEdge(edge) && edge.source_node_id === selectedNodeOccurrence.nodeId)
        .map((edge) => edge.target_node_id),
    );
  }, [selectedOccurrenceNetworkData, selectedNodeOccurrence]);

  const sortableInstanceNodes = useMemo(() => {
    if (!selectedOccurrenceNetworkData) return [];

    const directInstanceNodes = selectedOccurrenceNetworkData.nodes.filter((node) => (
      directChildIds.has(node.id)
      && node.object?.object_type === 'instance'
      && !!node.instance?.schema_id
    ));

    if (directInstanceNodes.length > 0) {
      return directInstanceNodes;
    }

    return selectedOccurrenceNetworkData.nodes.filter((node) => (
      node.object?.object_type === 'instance'
      && !!node.instance?.schema_id
    ));
  }, [directChildIds, selectedOccurrenceNetworkData]);

  const sortableModelIds = useMemo(() => (
    Array.from(new Set(
      sortableInstanceNodes
        .map((node) => node.instance?.schema_id)
        .filter((value): value is string => !!value),
    ))
  ), [sortableInstanceNodes]);

  useEffect(() => {
    for (const modelId of sortableModelIds) {
      if (!fields[modelId]) {
        void loadFields(modelId);
      }
    }
  }, [fields, loadFields, sortableModelIds]);

  const meaningSortOptions = useMemo(() => (
    MEANING_SLOT_DEFINITIONS.map((definition) => ({
      value: definition.fieldMeaning,
      label: t(getMeaningSlotLabelKey(definition.key) as never),
    }))
  ), [t]);

  const propertySortOptions = useMemo(() => {
    const deduped = new Map<string, { value: string; label: string }>();

    for (const modelId of sortableModelIds) {
      const model = models.find((item) => item.id === modelId);
      for (const field of fields[modelId] ?? []) {
        deduped.set(field.id, {
          value: field.id,
          label: model ? `${field.name} - ${model.name}` : field.name,
        });
      }
    }

    return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [models, fields, sortableModelIds, t]);

  const canEditNodeConfig = !!selectedNodeOccurrence && parsedNodeMetadataDraft !== null;

  const updateSelectedOccurrenceDraft = useCallback((
    updater: (occurrence: InstanceNodeOccurrenceDraft) => InstanceNodeOccurrenceDraft,
  ) => {
    if (!selectedNodeOccurrence) return;
    session.setState((prev) => ({
      ...prev,
      nodeOccurrences: prev.nodeOccurrences.map((occurrence) => (
        occurrence.nodeId === selectedNodeOccurrence.nodeId ? updater(occurrence) : occurrence
      )),
    }));
  }, [selectedNodeOccurrence, session]);

  const updateSelectedOccurrenceMetadata = useCallback((metadata: string) => {
    updateSelectedOccurrenceDraft((occurrence) => ({ ...occurrence, metadata }));
  }, [updateSelectedOccurrenceDraft]);

  const updateSelectedOccurrenceNodeConfig = useCallback((nodeConfig: NodeConfig | null) => {
    const parsed = parseNodeMetadataObject(selectedNodeMetadataDraft);
    if (parsed === null) return;
    updateSelectedOccurrenceMetadata(stringifyNodeMetadataObject(upsertNodeConfigMetadata(parsed, nodeConfig)));
  }, [selectedNodeMetadataDraft, updateSelectedOccurrenceMetadata]);

  const updateStructuredNodeConfigDraft = useCallback((updater: (config: NodeConfig) => NodeConfig) => {
    if (!selectedNodeConfig) return;
    updateSelectedOccurrenceNodeConfig(updater(selectedNodeConfig));
  }, [selectedNodeConfig, updateSelectedOccurrenceNodeConfig]);

  const nodeOccurrenceOptions = useMemo(() => nodeOccurrences.map((item) => {
    const sameNetworkCount = nodeOccurrences.filter((candidate) => candidate.networkId === item.networkId).length;
    const occurrenceIndex = nodeOccurrences
      .filter((candidate) => candidate.networkId === item.networkId)
      .findIndex((candidate) => candidate.nodeId === item.nodeId);
    const suffix = sameNetworkCount > 1 ? ` / node ${occurrenceIndex + 1}` : '';
    return {
      value: item.nodeId,
      label: `${item.networkName}${suffix}`,
    };
  }), [nodeOccurrences]);

  const nodeLayoutOptions = useMemo(() => ([
    { value: '', label: t('common.none') ?? 'None' },
    { value: 'freeform', label: t('instance.nodeLayoutKindOptions.freeform' as never) },
    { value: 'grid', label: t('instance.nodeLayoutKindOptions.grid' as never) },
    { value: 'list', label: t('instance.nodeLayoutKindOptions.list' as never) },
  ]), [t]);

  const sortKindOptions = useMemo(() => ([
    { value: '', label: t('common.none') ?? 'None' },
    { value: 'meaning_binding', label: t('instance.nodeSortKindOptions.meaning_slot' as never) },
    { value: 'property', label: t('instance.nodeSortKindOptions.property' as never) },
  ]), [t]);

  const sortDirectionOptions = useMemo(() => ([
    { value: 'asc', label: t('instance.nodeSortDirectionOptions.asc' as never) },
    { value: 'desc', label: t('instance.nodeSortDirectionOptions.desc' as never) },
  ]), [t]);

  const emptyPlacementOptions = useMemo(() => ([
    { value: 'last', label: t('instance.nodeSortEmptyOptions.last' as never) },
    { value: 'first', label: t('instance.nodeSortEmptyOptions.first' as never) },
  ]), [t]);

  const sortableNodeConfig = isSortableNodeConfig(selectedNodeConfig) ? selectedNodeConfig : null;
  const sortableNodeSortConfig = sortableNodeConfig?.sort ?? null;

  const handleInstanceVisualModeChange = useCallback((mode: VisualMode) => {
    setInstanceVisualMode(mode);
    session.setState((prev) => {
      const currentIcon = prev.icon ?? '';
      const currentMode = resolveVisualMode(currentIcon);
      return currentMode === mode ? prev : { ...prev, icon: null };
    });
  }, [session]);

  if (!isDraft && !instance) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        Loading...
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const update = (patch: Partial<InstanceEditorState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const handleDelete = async () => {
    if (isDraft) return;
    await deleteInstance(tab.targetId);
    useEditorStore.getState().closeTab(tab.id);
  };

  const selectedModelName = session.state.modelId ? (() => {
    const model = models.find((a) => a.id === session.state.modelId);
    return model ? model.name : null;
  })() : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <NetworkObjectEditorShell
          badge={t('objectPanel.instance' as never)}
          title={session.state.title || tab.title || t('instance.defaultTitle')}
          subtitle={isDraft ? t('instance.create') : t('editorShell.networkObject' as never)}
          description={selectedModelName}
          leadingVisual={<NodeVisual icon={session.state.icon ?? 'box'} size={24} imageSize={56} className="shrink-0" />}
          initialViewMode={tab.objectViewMode ?? 'body'}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)} defaultOpen={isDraft} viewMode="body">
              <Input
                value={session.state.title}
                onChange={(e) => {
                  update({ title: e.target.value });
                  useEditorStore.getState().updateTitle(tab.id, e.target.value);
                }}
                placeholder={t('instance.title') ?? 'Title'}
                inputSize={isDraft ? undefined : 'sm'}
                autoFocus={isDraft}
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-secondary">{t('instance.visual' as never)}</label>
                <div className="flex flex-col gap-2">
                  <RadioGroup
                    options={instanceVisualModeOptions}
                    value={instanceVisualMode}
                    onChange={(value) => handleInstanceVisualModeChange(value as VisualMode)}
                    orientation="horizontal"
                  />
                  {instanceVisualMode === 'icon' ? (
                    <IconSelector
                      value={!isImageSourceValue(session.state.icon) ? (session.state.icon ?? undefined) : undefined}
                      onChange={(name) => update({ icon: name || null })}
                      placeholder={t('iconSelector.selectIcon')}
                    />
                  ) : (
                    <FilePicker
                      value={isImageSourceValue(session.state.icon) ? session.state.icon ?? '' : ''}
                      onChange={(path) => update({ icon: path || null })}
                      placeholder={t('instance.selectProfileImage' as never)}
                      filters={[...IMAGE_FILE_FILTERS]}
                    />
                  )}
                </div>
                <div className="mt-1 text-[11px] text-muted">{t('instance.visualHint' as never)}</div>
              </div>

              {models.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">{t('instance.model') ?? 'Model'}</label>
                  <Select
                    options={modelOptions}
                    value={session.state.modelId ?? ''}
                    onChange={(e) => {
                      update({ modelId: e.target.value || null, properties: {} });
                    }}
                    selectSize="sm"
                  />
                </div>
              )}
            </NetworkObjectEditorSection>

            {session.state.modelId && (
              <NetworkObjectEditorSection title={t('instance.properties')} viewMode="body">
                {isDraft ? (
                  modelFields.length > 0 ? (
                    <InstancePropertyInputs
                      fields={modelFields}
                      properties={session.state.properties}
                      onChange={(fieldId, value) => update({
                        properties: { ...session.state.properties, [fieldId]: value },
                      })}
                    />
                  ) : null
                ) : (
                  <InstancePropertiesPanel
                    modelId={session.state.modelId}
                    projectId={currentProject?.id}
                    instanceId={tab.targetId}
                    properties={session.state.properties}
                    onChange={(fieldId, value) => update({
                      properties: { ...session.state.properties, [fieldId]: value },
                    })}
                  />
                )}
              </NetworkObjectEditorSection>
            )}

            {!isDraft && currentProject && session.state.modelId && (
              <NetworkObjectEditorSection title={t('editorShell.interactiveView' as never)} viewMode="interactive">
                <InteractiveViewPanel
                  tabId={tab.id}
                  projectId={currentProject.id}
                  schemaId={session.state.modelId}
                  instanceId={tab.targetId}
                  fields={modelFields}
                  properties={session.state.properties}
                  content={session.state.content}
                  onFieldChange={(fieldId, value) => update({
                    properties: { ...session.state.properties, [fieldId]: value },
                  })}
                  mode="view"
                />
              </NetworkObjectEditorSection>
            )}

            <NetworkObjectEditorSection title={t('editorShell.content' as never)} viewMode="body" fullBleed>
              <InstanceBodyEditor
                tabId={tab.id}
                content={session.state.content ?? ''}
                projectId={currentProject?.id}
                instanceId={isDraft ? null : tab.targetId}
                onChange={(content) => update({ content: content || null })}
              />
            </NetworkObjectEditorSection>

            {!isDraft && (
              <NetworkObjectEditorSection title={t('instance.networkPlacement' as never)} viewMode="details">
                {nodeOccurrences.length === 0 ? (
                  <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-2 text-xs text-muted">
                    {t('instance.noNetworkPlacement' as never)}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-secondary">{t('instance.networkPlacement' as never)}</label>
                      <Select
                        options={nodeOccurrenceOptions}
                        value={selectedNodeId}
                        onChange={(e) => setSelectedNodeId(e.target.value)}
                        selectSize="sm"
                      />
                    </div>

                    {selectedNodeOccurrence && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openNetwork(selectedNodeOccurrence.networkId)}
                          >
                            {t('network.switchNetwork')}
                          </Button>
                          <div className="min-w-0 rounded-lg border border-subtle bg-surface-editor px-3 py-1.5 text-xs text-muted">
                            <div className="truncate">{selectedNodeOccurrence.nodeId}</div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-secondary">{t('instance.nodeRole' as never)}</label>
                          <Select
                            options={nodeTypeOptions}
                            value={selectedNodeOccurrence.nodeType}
                            onChange={(e) => updateSelectedOccurrenceDraft((occurrence) => ({
                              ...occurrence,
                              nodeType: e.target.value as NodeType,
                            }))}
                            selectSize="sm"
                          />
                          <div className="text-[11px] text-muted">{t('instance.nodeRoleHint' as never)}</div>
                        </div>

                        {isGroupNodeOccurrence && (
                          <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-editor px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-secondary">{t('instance.nodeLayoutKind' as never)}</label>
                              <Select
                                options={nodeLayoutOptions}
                                value={selectedNodeConfig?.kind ?? ''}
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    updateSelectedOccurrenceNodeConfig(null);
                                    return;
                                  }

                                  const previousSort = isSortableNodeConfig(selectedNodeConfig)
                                    ? selectedNodeConfig.sort ?? null
                                    : null;

                                  updateSelectedOccurrenceNodeConfig(
                                    createNodeConfigDraft(e.target.value as NodeConfig['kind'], previousSort),
                                  );
                                }}
                                selectSize="sm"
                                disabled={!canEditNodeConfig}
                              />
                              <div className="text-[11px] text-muted">{t('instance.nodeConfigHint' as never)}</div>
                            </div>

                            {selectedNodeConfig?.kind === 'grid' && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigColumns' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.columns ?? 2}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, columns: Math.max(1, Math.floor(value)) }
                                          : config
                                      ))}
                                      min={1}
                                      step={1}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigPadding' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.padding ?? 24}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, padding: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigGapX' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.gapX ?? 16}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, gapX: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigGapY' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.gapY ?? 16}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, gapY: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigItemWidth' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.itemWidth ?? 160}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, itemWidth: Math.max(48, value) }
                                          : config
                                      ))}
                                      min={48}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigItemHeight' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.itemHeight ?? 60}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, itemHeight: Math.max(40, value) }
                                          : config
                                      ))}
                                      min={40}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {selectedNodeConfig?.kind === 'list' && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigPadding' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.padding ?? 24}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'list'
                                          ? { ...config, padding: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigGap' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.gap ?? 12}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'list'
                                          ? { ...config, gap: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('instance.nodeConfigItemHeight' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.itemHeight ?? 60}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'list'
                                          ? { ...config, itemHeight: Math.max(40, value) }
                                          : config
                                      ))}
                                      min={40}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {sortableNodeConfig && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('instance.nodeSortKind' as never)}</label>
                                  <Select
                                    options={sortKindOptions}
                                    value={sortableNodeSortConfig?.kind ?? ''}
                                    onChange={(e) => {
                                      if (!e.target.value) {
                                        updateStructuredNodeConfigDraft((config) => (
                                          isSortableNodeConfig(config) ? { ...config, sort: null } : config
                                        ));
                                        return;
                                      }

                                      updateStructuredNodeConfigDraft((config) => (
                                        isSortableNodeConfig(config)
                                          ? {
                                              ...config,
                                              sort: createSortConfigDraft(
                                                e.target.value as NodeSortConfig['kind'],
                                                propertySortOptions[0]?.value,
                                              ),
                                            }
                                          : config
                                      ));
                                    }}
                                    selectSize="sm"
                                    disabled={!canEditNodeConfig}
                                  />
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('instance.nodeSortValue' as never)}</label>
                                  {sortableNodeSortConfig?.kind === 'meaning_binding' ? (
                                    <Select
                                      options={meaningSortOptions}
                                      value={sortableNodeSortConfig.meaning}
                                      onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                        isSortableNodeConfig(config) && config.sort?.kind === 'meaning_binding'
                                          ? { ...config, sort: { ...config.sort, meaning: e.target.value as FieldMeaningBindingKey } }
                                          : config
                                      ))}
                                      selectSize="sm"
                                      searchable
                                      disabled={!canEditNodeConfig}
                                    />
                                  ) : sortableNodeSortConfig?.kind === 'property' ? (
                                    <Select
                                      options={propertySortOptions}
                                      value={sortableNodeSortConfig.fieldId}
                                      onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                        isSortableNodeConfig(config) && config.sort?.kind === 'property'
                                          ? { ...config, sort: { ...config.sort, fieldId: e.target.value } }
                                          : config
                                      ))}
                                      selectSize="sm"
                                      searchable
                                      emptyMessage={t('instance.nodeSortNoPropertyOptions' as never)}
                                      disabled={!canEditNodeConfig || propertySortOptions.length === 0}
                                    />
                                  ) : (
                                    <Input
                                      value=""
                                      readOnly
                                      inputSize="sm"
                                      placeholder={t('instance.nodeSortValueDisabled' as never)}
                                    />
                                  )}
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('instance.nodeSortDirection' as never)}</label>
                                  <Select
                                    options={sortDirectionOptions}
                                    value={sortableNodeSortConfig?.direction ?? 'asc'}
                                    onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                      isSortableNodeConfig(config) && config.sort
                                        ? { ...config, sort: { ...config.sort, direction: e.target.value as 'asc' | 'desc' } }
                                        : config
                                    ))}
                                    selectSize="sm"
                                    disabled={!sortableNodeSortConfig || !canEditNodeConfig}
                                  />
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('instance.nodeSortEmptyPlacement' as never)}</label>
                                  <Select
                                    options={emptyPlacementOptions}
                                    value={sortableNodeSortConfig?.emptyPlacement ?? 'last'}
                                    onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                      isSortableNodeConfig(config) && config.sort
                                        ? { ...config, sort: { ...config.sort, emptyPlacement: e.target.value as 'first' | 'last' } }
                                        : config
                                    ))}
                                    selectSize="sm"
                                    disabled={!sortableNodeSortConfig || !canEditNodeConfig}
                                  />
                                </div>
                              </div>
                            )}

                            {!canEditNodeConfig && (
                              <div className="text-[11px] text-muted">
                                {t('instance.nodeConfigInvalidMetadataHint' as never)}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-secondary">{t('instance.nodeMetadata' as never)}</label>
                          <TextArea
                            value={selectedNodeMetadataDraft}
                            onChange={(e) => updateSelectedOccurrenceMetadata(e.target.value)}
                            rows={4}
                            placeholder='{"label":"local note"}'
                            className="font-mono text-xs"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </NetworkObjectEditorSection>
            )}

            {!isDraft && currentProject && session.state.modelId && (
              <NetworkObjectEditorSection title={t('interactiveView.configure' as never)} viewMode="details">
                <InteractiveViewPanel
                  projectId={currentProject.id}
                  schemaId={session.state.modelId}
                  instanceId={tab.targetId}
                  fields={modelFields}
                  properties={session.state.properties}
                  content={session.state.content}
                  onFieldChange={(fieldId, value) => update({
                    properties: { ...session.state.properties, [fieldId]: value },
                  })}
                  mode="configure"
                />
              </NetworkObjectEditorSection>
            )}

            {!isDraft && (
              <NetworkObjectEditorSection title="Agent" defaultOpen={false} viewMode="details">
                <div className="h-[min(60vh,560px)] min-h-[320px] overflow-hidden rounded-lg border border-subtle bg-surface-editor">
                  <InstanceAgentView instanceId={tab.targetId} agentContent={instance?.agent_content ?? null} />
                </div>
              </NetworkObjectEditorSection>
            )}

            {!isDraft && instance && (
              <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false} viewMode="details">
                <NetworkObjectMetadataList
                  items={[
                    { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{instance.id}</code> },
                    { label: t('instance.model'), value: selectedModelName ?? t('common.none') },
                  ]}
                />
              </NetworkObjectEditorSection>
            )}

            {!isDraft && (
              <div className="mx-auto flex w-full max-w-[760px] justify-end px-6 pt-1" data-network-object-view-mode="details">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="bg-status-error/10 text-status-error hover:bg-status-error/15 hover:text-status-error"
                  onClick={() => { void handleDelete(); }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            )}
          </NetworkObjectEditorShell>
      </ScrollArea>
    </div>
  );
}
