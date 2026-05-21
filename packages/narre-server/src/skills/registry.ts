import type { SkillId } from '@netior/shared/types';
import {
  dedupeSkillsBySlashTrigger,
  loadUserAgentSkills,
  type LoadUserAgentSkillsOptions,
} from '../agent-skills/user-agent-skill-loader.js';
import type { NarreSkillDefinition } from './types.js';

export async function loadAvailableSkills(
  options: LoadUserAgentSkillsOptions = {},
): Promise<NarreSkillDefinition[]> {
  const builtInSkills = await loadBuiltInSkills();
  const userSkills = await loadUserAgentSkills(options);
  return dedupeSkillsBySlashTrigger([
    ...builtInSkills,
    ...userSkills,
  ]);
}

export async function loadBuiltInSkills(): Promise<NarreSkillDefinition[]> {
  return [
    (await import('./bootstrap-skill.js')).bootstrapSkill,
    (await import('./index-skill.js')).indexSkill,
    (await import('./interactive-view-skill.js')).interactiveViewSkill,
    (await import('./network-representation-skill.js')).networkRepresentationSkill,
    (await import('./schema-field-behavior-skill.js')).schemaFieldBehaviorSkill,
  ];
}

export async function loadSkill(
  skillId: SkillId | undefined,
): Promise<NarreSkillDefinition | null> {
  switch (skillId) {
    case 'bootstrap':
      return (await import('./bootstrap-skill.js')).bootstrapSkill;
    case 'index':
      return (await import('./index-skill.js')).indexSkill;
    case 'interactive-view':
      return (await import('./interactive-view-skill.js')).interactiveViewSkill;
    case 'network-representation-authoring':
      return (await import('./network-representation-skill.js')).networkRepresentationSkill;
    case 'schema-field-behavior':
      return (await import('./schema-field-behavior-skill.js')).schemaFieldBehaviorSkill;
    default:
      return null;
  }
}
