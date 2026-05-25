export { HIERARCHY_PARENT_MEANING_KEY } from './edge-meanings';

export function isHierarchyParentModelKey(key: string | null | undefined): boolean {
  return key === 'parent';
}
