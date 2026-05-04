import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { NarreCard } from '@netior/shared/types';
import {
  askToolModel,
  confirmToolModel,
  draftToolModel,
  type AskToolArgs,
  type ConfirmToolArgs,
  type DraftToolArgs,
} from './ui-schemas.js';
import type { NarreUiBridge } from './ui-bridge.js';

export function createClaudeSdkUiServer(sendCard: (card: NarreCard) => void, uiBridge: NarreUiBridge) {
  return createSdkMcpServer({
    name: 'narre-ui',
    tools: [
      tool(
        'propose',
        'Present an editable draft block to the user. Use this when suggesting models, models, concepts, or any structured plan that the user may revise.',
        draftToolModel.shape,
        async (args: DraftToolArgs) => ({
          content: [{
            type: 'text' as const,
            text: await uiBridge.requestDraft(sendCard, args),
          }],
        }),
      ),
      tool(
        'ask',
        'Ask the user a structured question with selectable options. Use for gathering preferences or domain information.',
        askToolModel.shape,
        async (args: AskToolArgs) => ({
          content: [{
            type: 'text' as const,
            text: await uiBridge.requestInterview(sendCard, args),
          }],
        }),
      ),
      tool(
        'confirm',
        'Request user confirmation before a destructive or significant action.',
        confirmToolModel.shape,
        async (args: ConfirmToolArgs) => ({
          content: [{
            type: 'text' as const,
            text: await uiBridge.requestPermission(sendCard, args),
          }],
        }),
      ),
    ],
  });
}
