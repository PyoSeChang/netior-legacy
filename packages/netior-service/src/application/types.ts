export interface DomainOperationContext {
  method: string;
  operationId: string | null;
  params: Record<string, unknown>;
}

export type DomainOperation = (context: DomainOperationContext) => unknown;
export type DomainOperationRegistry = Map<string, DomainOperation>;

export function registerOperation(
  registry: DomainOperationRegistry,
  method: string,
  operation: DomainOperation,
): void {
  registry.set(method, operation);
}
