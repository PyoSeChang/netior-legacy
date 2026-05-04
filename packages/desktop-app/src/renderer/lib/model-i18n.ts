import {
  getModelDescriptionKey,
  getModelLabelKey,
} from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import type { Model, ModelKey } from '@netior/shared/types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;
type ModelDisplaySource = Pick<Model, 'key' | 'name' | 'description' | 'built_in'>;

export function getModelDisplayName(model: ModelDisplaySource, t: Translate): string {
  if (!model.built_in) return model.name;
  const labelKey = getModelLabelKey(model.key as ModelKey);
  const label = t(labelKey as TranslationKey);
  return label === labelKey ? model.name : label;
}

export function getModelDisplayDescription(
  model: ModelDisplaySource,
  t: Translate,
): string | null {
  if (!model.built_in) return model.description;
  const descriptionKey = getModelDescriptionKey(model.key as ModelKey);
  const description = t(descriptionKey as TranslationKey);
  return description === descriptionKey ? model.description : description;
}
