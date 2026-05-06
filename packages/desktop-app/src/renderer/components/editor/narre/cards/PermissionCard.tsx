import React, { useCallback, useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { getFieldMeaningBindingDefinition } from '@netior/shared/constants';
import type { NarrePermissionCard } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { useI18n } from '../../../../hooks/useI18n';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { getModelDisplayName } from '../../../../lib/model-i18n';
import {
  getLocalizedToolDescription,
  getLocalizedToolLabel,
} from '../narre-tool-presenter-localized';

interface PermissionCardProps {
  card: NarrePermissionCard;
  onAction: (actionKey: string) => Promise<void> | void;
  submittedResponse?: unknown;
  compact?: boolean;
  showSubmittedDecision?: boolean;
  hidePreviewHeader?: boolean;
}

function formatPermissionActionLabel(
  action: NarrePermissionCard['actions'][number],
  t: ReturnType<typeof useI18n>['t'],
): string {
  switch (action.key.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
      return t('narre.card.permissionAllowProject' as never);
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return t('narre.card.permissionAllow' as never);
    case 'decline':
    case 'deny':
    case 'cancel':
      return t('narre.card.permissionDecline' as never);
    default:
      return action.label;
  }
}

function formatPermissionDecisionLabel(
  actionKey: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  switch (actionKey.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
      return t('narre.card.permissionAllowedProject' as never);
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return t('narre.card.permissionAllowed' as never);
    case 'decline':
    case 'deny':
    case 'cancel':
      return t('narre.card.permissionDeclined' as never);
    default:
      return actionKey;
  }
}

function getPermissionDecisionVariant(actionKey: string | null): 'success' | 'error' | 'default' {
  if (!actionKey) {
    return 'default';
  }

  switch (actionKey.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return 'success';
    case 'decline':
    case 'deny':
    case 'cancel':
      return 'error';
    default:
      return 'default';
  }
}

function getActionButtonVariant(actionKey: string, actionVariant?: 'danger' | 'default'): 'primary' | 'secondary' | 'danger' {
  if (actionVariant === 'danger') {
    return 'danger';
  }

  switch (actionKey.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
      return 'secondary';
    default:
      return 'primary';
  }
}

function formatPreviewLabel(label: string, t: ReturnType<typeof useI18n>['t']): string {
  const key = toPreviewLabelKey(label);
  const translationKey = `narre.previewLabel.${key}`;
  const translated = t(translationKey as never);
  return translated === translationKey ? label : translated;
}

function toPreviewLabelKey(label: string): string {
  return label
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+([a-z])/g, (_match, char: string) => char.toUpperCase());
}

function getDisplayPreviewItems(
  items: NonNullable<NarrePermissionCard['preview']>['items'] | undefined,
  toolKey?: string | null,
): NonNullable<NarrePermissionCard['preview']>['items'] {
  if (!items) return [];

  const hasResolvedModelList = items.some((item) => item.kind === 'model_list' && item.models?.length);
  const visibleItems = items.filter((item) => {
    const key = toPreviewLabelKey(item.label);
    if (key === 'schemaId' || key === 'groupId' || key === 'projectId') {
      return false;
    }
    if (key === 'models' && hasResolvedModelList && !(item.kind === 'model_list' && item.models?.length)) {
      return false;
    }
    return true;
  });

  if (toolKey !== 'create_schema_field') {
    return visibleItems;
  }

  const order: Record<string, number> = {
    schema: 0,
    name: 1,
    description: 2,
    fieldType: 3,
    referenceSchema: 4,
    meaningBindings: 5,
    options: 6,
    required: 99,
  };

  return [...visibleItems].sort((a, b) => {
    const left = order[toPreviewLabelKey(a.label)] ?? 50;
    const right = order[toPreviewLabelKey(b.label)] ?? 50;
    return left - right;
  });
}

function toLucideExportName(icon: string): string {
  return icon
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function isRenderableIcon(candidate: unknown): candidate is React.ComponentType<{ size?: number; className?: string }> {
  return typeof candidate === 'function' || (candidate !== null && typeof candidate === 'object');
}

function renderIconValue(value: string | undefined): JSX.Element | string {
  if (!value) return '';
  const candidate = (LucideIcons as Record<string, unknown>)[toLucideExportName(value)];
  const Icon = isRenderableIcon(candidate)
    ? candidate
    : LucideIcons.CircleHelp;
  return (
    <span className="inline-flex items-center gap-1.5" title={value} aria-label={value}>
      <Icon size={14} className="text-secondary" />
    </span>
  );
}

function renderColorValue(value: string | undefined): JSX.Element | string {
  if (!value) return '';
  return (
    <span className="inline-flex items-center gap-1.5" title={value} aria-label={value}>
      <span
        className="inline-block h-4 w-4 rounded-full border border-default"
        style={{ backgroundColor: value }}
      />
    </span>
  );
}

function isImageLikeValue(value: string | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value)
    || /^file:\/\//i.test(value)
    || /^data:image\//i.test(value)
    || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(value);
}

function toImageSrc(value: string): string {
  if (/^(https?:|file:|data:image\/)/i.test(value)) {
    return value;
  }

  const normalized = value.replace(/\\/g, '/');
  if (/^[a-z]:\//i.test(normalized)) {
    return `file:///${normalized}`;
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`;
  }
  return value;
}

function renderImageValue(value: string | undefined): JSX.Element | string {
  if (!value) return '';
  if (!isImageLikeValue(value)) return value;
  return (
    <span className="inline-flex items-center gap-2" title={value}>
      <img
        src={toImageSrc(value)}
        alt=""
        className="h-10 w-10 rounded border border-default object-cover bg-surface-hover"
      />
    </span>
  );
}

function localizeFieldType(value: string | undefined, t: ReturnType<typeof useI18n>['t']): string {
  if (!value) return '';
  const translated = t(`typeSelector.${value}` as never);
  return translated === `typeSelector.${value}` ? value : translated;
}

function formatMeaningBindingPart(value: string, t: ReturnType<typeof useI18n>['t']): string {
  const definition = getFieldMeaningBindingDefinition(value as never);
  if (definition) {
    const slotKey = definition.key.split('.').at(-1);
    const slotTranslationKey = slotKey ? `semantic.slot.${slotKey}.label` : null;
    const slotLabel = slotTranslationKey ? t(slotTranslationKey as never) : null;
    if (slotLabel && slotLabel !== slotTranslationKey) {
      return slotLabel;
    }

    const semanticKey = definition.key.replace(/\./g, '_');
    const meaningTranslationKey = `semantic.meaning.${semanticKey}.label`;
    const meaningLabel = t(meaningTranslationKey as never);
    if (meaningLabel !== meaningTranslationKey) {
      return meaningLabel;
    }

    return definition.label;
  }

  const [scope, name] = value.split('.');
  const scopeKey = scope ? `semantic.meaning.${scope}.label` : null;
  const scopeLabel = scopeKey ? t(scopeKey as never) : null;
  const fallbackName = name
    ? name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : value;
  return scopeLabel && scopeLabel !== scopeKey
    ? `${scopeLabel}: ${fallbackName}`
    : value;
}

function localizeMeaningBindings(value: string | undefined, t: ReturnType<typeof useI18n>['t']): string {
  if (!value) return '';
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => formatMeaningBindingPart(part, t))
    .join(', ');
}

function renderNodeShapeValue(value: string | undefined, t: ReturnType<typeof useI18n>['t']): JSX.Element | string {
  if (!value) return '';
  const isCircle = value === 'circle';
  const isDiamond = value === 'diamond';
  const isHexagon = value === 'hexagon';
  const isParallelogram = value === 'parallelogram';
  const isCylinder = value === 'cylinder';
  const translated = t(`schema.${value}` as never);
  const label = translated === `schema.${value}` ? value : translated;
  return (
    <span className="inline-flex items-center gap-1.5" title={label} aria-label={label}>
      <span
        className={[
          'inline-block h-4 w-5 border border-default bg-surface-hover',
          isCircle ? 'rounded-full' : '',
          isDiamond ? 'h-3.5 w-3.5 rotate-45 rounded-[2px]' : '',
          value === 'rounded' ? 'rounded-md' : '',
          value === 'stadium' ? 'rounded-full' : '',
          !isCircle && !isDiamond && value !== 'rounded' && value !== 'stadium' ? 'rounded-[2px]' : '',
        ].join(' ')}
        style={{
          ...(isHexagon ? { clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' } : {}),
          ...(isParallelogram ? { transform: 'skew(-16deg)' } : {}),
          ...(isCylinder ? { borderRadius: '50% / 20%' } : {}),
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function inferToolKeyFromMessage(message: string): string | null {
  const match = message.match(/tool "([^"]+)"/i);
  return match?.[1] ?? null;
}

function formatLocalizedPreviewTitle(
  title: string | undefined,
  toolKey: string | null,
  locale: string,
): string | undefined {
  if (!title || !toolKey) return title;

  const localizedLabel = getLocalizedToolLabel(toolKey, locale, title);
  const separatorIndex = title.indexOf(':');
  if (separatorIndex >= 0) {
    const suffix = title.slice(separatorIndex + 1).trim();
    return suffix ? `${localizedLabel}: ${suffix}` : localizedLabel;
  }

  return localizedLabel;
}

function localizePreviewSummary(
  summary: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const [key, countText] = summary.split(':');
  const translationKey = `narre.previewSummary.${key}`;
  const count = Number.parseInt(countText ?? '', 10);
  const translated = Number.isFinite(count)
    ? t(translationKey as TranslationKey, { count })
    : t(translationKey as TranslationKey);
  return translated === translationKey ? summary : translated;
}

function PreviewValue({
  item,
  t,
}: {
  item: NonNullable<NarrePermissionCard['preview']>['items'][number];
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  const labelKey = toPreviewLabelKey(item.label);

  if (item.kind === 'model_list' && item.models?.length) {
    return (
      <span className="inline-flex flex-wrap gap-x-1.5 gap-y-1">
        {item.models.map((model) => (
          <span key={model.key} className="inline-flex items-center gap-1">
            <span>
              {getModelDisplayName({
                key: model.key as never,
                name: model.name,
                description: model.description ?? null,
                built_in: model.built_in === true,
              }, t)}
            </span>
          </span>
        ))}
      </span>
    );
  }

  if (item.kind === 'icon') {
    return <>{renderIconValue(item.value)}</>;
  }

  if (item.kind === 'color') {
    return <>{renderColorValue(item.value)}</>;
  }

  if (item.kind === 'node_shape') {
    return <>{renderNodeShapeValue(item.value, t)}</>;
  }

  if (labelKey === 'fieldType') {
    return <>{localizeFieldType(item.value, t)}</>;
  }

  if (labelKey === 'meaningBindings') {
    return <>{localizeMeaningBindings(item.value, t)}</>;
  }

  if (labelKey === 'profileImage' || isImageLikeValue(item.value)) {
    return <>{renderImageValue(item.value)}</>;
  }

  return (
    <>
      {item.value}
      {item.detail ? <span className="text-muted"> {item.detail}</span> : null}
    </>
  );
}

export function PermissionCard({
  card,
  onAction,
  submittedResponse,
  compact = false,
  showSubmittedDecision = true,
  hidePreviewHeader = false,
}: PermissionCardProps): JSX.Element {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [submittedActionKey, setSubmittedActionKey] = useState<string | null>(null);

  const resolvedActionKey = useMemo(() => {
    if (submittedActionKey) {
      return submittedActionKey;
    }

    if (typeof card.resolvedActionKey === 'string' && card.resolvedActionKey.length > 0) {
      return card.resolvedActionKey;
    }

    if (!submittedResponse || typeof submittedResponse !== 'object') {
      return null;
    }

    const candidate = submittedResponse as { action?: unknown };
    return typeof candidate.action === 'string' ? candidate.action : null;
  }, [card.resolvedActionKey, submittedActionKey, submittedResponse]);

  const isSubmitted = status === 'submitted' || resolvedActionKey !== null;

  const handleAction = useCallback(async (actionKey: string) => {
    if (status === 'submitting' || isSubmitted) {
      return;
    }

    setStatus('submitting');
    try {
      await onAction(actionKey);
      setSubmittedActionKey(actionKey);
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [isSubmitted, onAction, status]);

  const submittedActionLabel = resolvedActionKey
    ? formatPermissionDecisionLabel(resolvedActionKey, t)
    : null;
  const submittedActionVariant = getPermissionDecisionVariant(resolvedActionKey);
  const preview = card.preview;
  const resolvedPreviewToolKey = preview?.toolKey ?? inferToolKeyFromMessage(card.message);
  const previewTitle = resolvedPreviewToolKey
    ? formatLocalizedPreviewTitle(preview?.title, resolvedPreviewToolKey, locale)
    : preview?.title;
  const previewDescription = resolvedPreviewToolKey
    ? getLocalizedToolDescription(resolvedPreviewToolKey, locale, preview?.description)
    : preview?.description;
  const previewSummary = preview
    ? localizePreviewSummary(preview.summary, t)
    : null;
  const previewItems = getDisplayPreviewItems(preview?.items, resolvedPreviewToolKey);
  const shouldShowPreviewSummary = Boolean(
    previewSummary
    && previewSummary !== previewDescription
    && previewSummary !== preview?.description,
  );
  const previewElement = preview ? (
    <div className="rounded-md border border-subtle bg-surface-card px-2.5 py-2 text-xs">
      {!hidePreviewHeader && (
        <>
          <div className="font-medium text-default">{previewTitle}</div>
          {previewDescription && (
            <div className="mt-0.5 text-secondary">{previewDescription}</div>
          )}
          {shouldShowPreviewSummary && (
            <div className="mt-1 text-muted">{previewSummary}</div>
          )}
        </>
      )}
      {previewItems.length > 0 && (
        <div className={`${hidePreviewHeader ? '' : 'mt-2'} grid gap-1`}>
          {previewItems.map((item, index) => (
            <div key={`${item.label}:${index}`} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
              <span className="text-muted">{formatPreviewLabel(item.label, t)}</span>
              <span className="min-w-0 break-words text-secondary">
                <PreviewValue item={item} t={t} />
              </span>
            </div>
          ))}
        </div>
      )}
      {preview.details && preview.details.length > 0 && (
        <div className="mt-2 space-y-1 text-muted">
          {preview.details.map((detail, index) => (
            <div key={`${detail}:${index}`}>{detail}</div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className={compact ? 'pt-0.5' : 'px-3 py-3'}>
      {isSubmitted ? (
        <div className="flex flex-col gap-2">
          {previewElement}
          {showSubmittedDecision && submittedActionLabel && (
            <div className="flex items-center gap-2">
              <Badge variant={submittedActionVariant}>
                {submittedActionLabel}
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {previewElement}
          <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'justify-start' : 'justify-end'}`}>
            {status === 'error' && <Badge variant="error">{t('narre.card.submitFailed')}</Badge>}
            {card.actions.map((action) => (
              <Button
                key={action.key}
                variant={getActionButtonVariant(action.key, action.variant)}
                size="sm"
                disabled={status === 'submitting'}
                onClick={() => { void handleAction(action.key); }}
              >
                {formatPermissionActionLabel(action, t)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
