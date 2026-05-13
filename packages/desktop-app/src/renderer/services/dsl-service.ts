import type { NetiorDslEvaluateRequest, NetiorDslEvalResult } from '@netior/shared/dsl';
import { unwrapIpc } from './ipc';

export async function evaluateDsl(data: NetiorDslEvaluateRequest): Promise<NetiorDslEvalResult> {
  return unwrapIpc(await window.electron.dsl.evaluate(data as unknown as Record<string, unknown>));
}

export const dslService = {
  evaluate: evaluateDsl,
};
