import type {
  Meaning,
  MeaningCreate,
  MeaningUpdate,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

function getMeaningApi(): NonNullable<typeof window.electron.meaning> {
  if (!window.electron.meaning) {
    throw new Error('Meaning IPC API is unavailable. Restart the Electron dev app so the updated preload script is loaded.');
  }
  return window.electron.meaning;
}

export async function createMeaning(data: MeaningCreate): Promise<Meaning> {
  return unwrapIpc(await getMeaningApi().create(data as unknown as Record<string, unknown>));
}

export async function listMeanings(rootNetworkId: string): Promise<Meaning[]> {
  return unwrapIpc(await getMeaningApi().list(rootNetworkId));
}

export async function getMeaning(id: string): Promise<Meaning | undefined> {
  return unwrapIpc(await getMeaningApi().get(id));
}

export async function updateMeaning(id: string, data: MeaningUpdate): Promise<Meaning> {
  return unwrapIpc(await getMeaningApi().update(id, data as unknown as Record<string, unknown>));
}

export async function deleteMeaning(id: string): Promise<boolean> {
  console.info('[MeaningDelete][renderer-service] invoke', { id });
  const result = unwrapIpc<boolean>(await getMeaningApi().delete(id));
  console.info('[MeaningDelete][renderer-service] result', { id, result });
  return result;
}

export const meaningService = {
  create: createMeaning,
  list: listMeanings,
  get: getMeaning,
  update: updateMeaning,
  delete: deleteMeaning,
};
