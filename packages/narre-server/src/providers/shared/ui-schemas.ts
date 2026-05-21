import { z } from 'zod';

export const proposalCellTypeModel = z.enum(['text', 'icon', 'color', 'enum', 'boolean', 'readonly']);

export const draftToolModel = z.object({
  title: z.string().optional().describe('Optional title for the draft block'),
  content: z.string().describe('Editable markdown or plain-text draft shown to the user'),
  format: z.enum(['markdown']).optional().describe('Draft format. Defaults to markdown'),
  placeholder: z.string().optional().describe('Optional placeholder when the draft body starts empty'),
  confirmLabel: z.string().optional().describe('Optional label for the accept button'),
  feedbackLabel: z.string().optional().describe('Optional label for the feedback button'),
  feedbackPlaceholder: z.string().optional().describe('Optional placeholder for the feedback field'),
});

export const askToolModel = z.object({
  question: z.string().describe('The question to ask'),
  options: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })),
  multiSelect: z.boolean().optional().describe('Allow multiple selections'),
  allowText: z.boolean().optional().describe('Allow free-form text input alongside selections'),
  textPlaceholder: z.string().optional().describe('Optional placeholder for the free-form input'),
  submitLabel: z.string().optional().describe('Optional submit button label'),
});

export const confirmToolModel = z.object({
  message: z.string().describe('Description of the action requiring confirmation'),
  preview: z.object({
    toolKey: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    summary: z.string(),
    items: z.array(z.object({
      label: z.string(),
      value: z.string().optional(),
      detail: z.string().optional(),
      kind: z.enum(['text', 'icon', 'color', 'model_list']).optional(),
      models: z.array(z.object({
        key: z.string(),
        name: z.string(),
        description: z.string().nullable().optional(),
        built_in: z.boolean().optional(),
      })).optional(),
    })).optional(),
    details: z.array(z.string()).optional(),
  }).optional().describe('Optional structured preview of the action being confirmed'),
  actions: z.array(z.object({
    key: z.string(),
    label: z.string(),
    variant: z.enum(['danger', 'default']).optional(),
  })),
});

export type DraftToolArgs = z.infer<typeof draftToolModel>;
export type AskToolArgs = z.infer<typeof askToolModel>;
export type ConfirmToolArgs = z.infer<typeof confirmToolModel>;
