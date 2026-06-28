import type { World } from '@netior/shared/types';

type WorldPathRecord = {
  root_uri?: string | null;
  path?: string | null;
};

export function getWorldRootDir(world: World | null | undefined): string {
  if (!world) return '';
  const record = world as unknown as WorldPathRecord;
  return record.root_uri ?? record.path ?? '';
}
