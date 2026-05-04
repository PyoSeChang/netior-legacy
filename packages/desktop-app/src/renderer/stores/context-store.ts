import { create } from 'zustand';
import type { Context, ContextCreate, ContextUpdate, ContextMember } from '@netior/shared/types';
import { contextService } from '../services';

interface ContextStore {
  contexts: Context[];
  membersByContext: Record<string, ContextMember[]>;
  activeContextId: string | null;
  loading: boolean;

  loadContexts: (networkId: string) => Promise<void>;
  loadMembers: (contextId: string) => Promise<void>;
  createContext: (data: ContextCreate) => Promise<Context>;
  updateContext: (id: string, data: ContextUpdate) => Promise<void>;
  deleteContext: (id: string) => Promise<void>;
  addMember: (contextId: string, memberType: 'object' | 'edge', memberId: string) => Promise<ContextMember>;
  removeMember: (id: string) => Promise<void>;
  setActiveContext: (contextId: string | null) => void;
  clear: () => void;
}

export const useContextStore = create<ContextStore>((set) => ({
  contexts: [],
  membersByContext: {},
  activeContextId: null,
  loading: false,

  loadContexts: async (networkId) => {
    set({ loading: true });
    try {
      const contexts = await contextService.list(networkId);
      set((state) => ({
        contexts,
        activeContextId:
          state.activeContextId && contexts.some((context) => context.id === state.activeContextId)
            ? state.activeContextId
            : null,
      }));
    } finally {
      set({ loading: false });
    }
  },

  loadMembers: async (contextId) => {
    const members = await contextService.getMembers(contextId);
    set((state) => ({
      membersByContext: {
        ...state.membersByContext,
        [contextId]: members,
      },
    }));
  },

  createContext: async (data) => {
    const context = await contextService.create(data);
    set((s) => ({ contexts: [...s.contexts, context] }));
    return context;
  },

  updateContext: async (id, data) => {
    const updated = await contextService.update(id, data);
    set((s) => ({
      contexts: s.contexts.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteContext: async (id) => {
    await contextService.delete(id);
    set((s) => ({
      contexts: s.contexts.filter((c) => c.id !== id),
      membersByContext: Object.fromEntries(
        Object.entries(s.membersByContext).filter(([contextId]) => contextId !== id),
      ),
      activeContextId: s.activeContextId === id ? null : s.activeContextId,
    }));
  },

  addMember: async (contextId, memberType, memberId) => {
    const member = await contextService.addMember(contextId, memberType, memberId);
    set((state) => ({
      membersByContext: {
        ...state.membersByContext,
        [contextId]: [...(state.membersByContext[contextId] ?? []), member],
      },
    }));
    return member;
  },

  removeMember: async (id) => {
    await contextService.removeMember(id);
    set((state) => ({
      membersByContext: Object.fromEntries(
        Object.entries(state.membersByContext).map(([contextId, members]) => [
          contextId,
          members.filter((member) => member.id !== id),
        ]),
      ),
    }));
  },

  setActiveContext: (contextId) => set({ activeContextId: contextId }),

  clear: () => set({ contexts: [], membersByContext: {}, activeContextId: null, loading: false }),
}));
