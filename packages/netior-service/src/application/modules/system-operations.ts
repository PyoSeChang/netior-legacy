import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerSystemOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'system.ping', () => ({ ok: true, timestamp: new Date().toISOString() }));
}
