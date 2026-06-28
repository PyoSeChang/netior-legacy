import { JsonRpcProtocolError } from '../errors';
import { createDomainOperationRegistry } from './registry';
import { objectParams } from './params';

const registry = createDomainOperationRegistry();

export function dispatchDomainOperation(method: string, params: unknown, rpcId: string | number | null): unknown {
  const operation = registry.get(method);
  if (!operation) {
    throw new JsonRpcProtocolError(-32601, `Method not found: ${method}`);
  }

  return operation({
    method,
    operationId: rpcId === null ? null : String(rpcId),
    params: objectParams(params),
  });
}
