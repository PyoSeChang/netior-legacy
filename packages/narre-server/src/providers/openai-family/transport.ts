import type { NarreProviderRunContext, NarreProviderRunResult } from '../../runtime/provider-adapter.js';
import type { NarreUiBridge } from '../shared/ui-bridge.js';

export interface OpenAIFamilyTransportRunContext extends NarreProviderRunContext {
  uiBridge: NarreUiBridge;
}

export interface OpenAIFamilyTransport {
  readonly name: string;
  steer?: (sessionId: string, message: string) => Promise<boolean> | boolean;
  run: (context: OpenAIFamilyTransportRunContext) => Promise<NarreProviderRunResult>;
}
