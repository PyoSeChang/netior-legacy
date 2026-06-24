import { getWorldById, listModules } from '../netior-service-client.js';
import { resolve } from 'path';

export async function getAllowedPaths(rootNetworkId: string): Promise<string[]> {
  return (await listModules(rootNetworkId)).map((module) => resolve(module.path));
}

export function isPathAllowed(targetPath: string, allowedPaths: string[]): boolean {
  const resolved = resolve(targetPath);
  return allowedPaths.some(allowed =>
    resolved === allowed || resolved.startsWith(allowed + '/') || resolved.startsWith(allowed + '\\')
  );
}

/**
 * Returns allowed paths array on success, or error message string on failure.
 * Validates against registered module paths.
 */
export async function validatePath(rootNetworkId: string, targetPath: string): Promise<string[] | string> {
  const allowed = await getAllowedPaths(rootNetworkId);
  if (allowed.length === 0) return 'No module paths registered for this world';
  if (!isPathAllowed(targetPath, allowed)) return 'Path is outside registered module paths';
  return allowed;
}

/**
 * Validates that a path is under the world directory.
 * Use this for file-entity-based operations where the file may not be under a module directory.
 * Returns null on success, or error message string on failure.
 */
export async function validateWorldRootPath(rootNetworkId: string, targetPath: string): Promise<string | null> {
  const world = await getWorldById(rootNetworkId);
  if (!world) return `World not found: ${rootNetworkId}`;
  const rootDir = resolve(world.root_dir);
  const resolved = resolve(targetPath);
  if (resolved === rootDir || resolved.startsWith(rootDir + '/') || resolved.startsWith(rootDir + '\\')) {
    return null;
  }
  return 'Path is outside the world directory';
}
