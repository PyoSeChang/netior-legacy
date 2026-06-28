import type { DomainOperationRegistry } from './types';
import { registerDefinitionOperations } from './modules/definition-operations';
import { registerEvidenceOperations } from './modules/evidence-operations';
import { registerEventOperations } from './modules/event-operations';
import { registerInstanceOperations } from './modules/instance-operations';
import { registerQueryOperations } from './modules/query-operations';
import { registerRelationOperations } from './modules/relation-operations';
import { registerResourceOperations } from './modules/resource-operations';
import { registerSystemOperations } from './modules/system-operations';
import { registerViewOperations } from './modules/view-operations';
import { registerWorldOperations } from './modules/world-operations';

export function createDomainOperationRegistry(): DomainOperationRegistry {
  const registry: DomainOperationRegistry = new Map();
  registerSystemOperations(registry);
  registerWorldOperations(registry);
  registerDefinitionOperations(registry);
  registerInstanceOperations(registry);
  registerResourceOperations(registry);
  registerRelationOperations(registry);
  registerEvidenceOperations(registry);
  registerEventOperations(registry);
  registerViewOperations(registry);
  registerQueryOperations(registry);
  return registry;
}
