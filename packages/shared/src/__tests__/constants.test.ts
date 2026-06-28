import { describe, expect, it } from 'vitest';
import {
  AGENT_SKILL_STORAGE,
  ASSIGNMENT_STATUSES,
  BUILT_IN_SKILLS,
  DEFAULTS,
  findSkillBySlashTrigger,
  getNarreToolMetadata,
  getNetiorMcpToolSpec,
  listNetiorMcpToolSpecs,
  PROPERTY_VALUE_TYPES,
  RESOURCE_SOURCE_KINDS,
  SLASH_TRIGGER_SKILLS,
  VIEW_TYPES,
  WORLD_NODE_TYPES,
} from '../constants';

describe('domain constants', () => {
  it('exposes the new world/model and domain enum values', () => {
    expect(WORLD_NODE_TYPES).toEqual(['world', 'model']);
    expect(PROPERTY_VALUE_TYPES).toContain('resource-ref');
    expect(ASSIGNMENT_STATUSES).toContain('candidate');
    expect(RESOURCE_SOURCE_KINDS).toContain('sub-resource');
    expect(VIEW_TYPES).toEqual(['explorer', 'canvas']);
  });
});

describe('DEFAULTS', () => {
  it('has window defaults', () => {
    expect(DEFAULTS.WINDOW_WIDTH).toBe(1200);
    expect(DEFAULTS.WINDOW_HEIGHT).toBe(800);
  });
});

describe('AGENT_SKILL_STORAGE', () => {
  it('exposes the user agent skill package layout', () => {
    expect(AGENT_SKILL_STORAGE.WORLD_CONFIG_DIR).toBe('.netior');
    expect(AGENT_SKILL_STORAGE.AGENTS_DIR).toBe('agents');
    expect(AGENT_SKILL_STORAGE.AGENT_FILE_NAME).toBe('agent.json');
    expect(AGENT_SKILL_STORAGE.SKILLS_DIR).toBe('skills');
    expect(AGENT_SKILL_STORAGE.SKILL_FILE_NAME).toBe('SKILL.md');
  });
});

describe('BUILT_IN_SKILLS', () => {
  it('keeps only current agent-facing slash skills', () => {
    expect(SLASH_TRIGGER_SKILLS.map((skill) => skill.id)).toEqual([
      'bootstrap',
      'index',
    ]);
    expect(BUILT_IN_SKILLS.some((skill) => skill.id === 'interactive-view')).toBe(false);
    expect(findSkillBySlashTrigger('bootstrap')?.id).toBe('bootstrap');
    expect(findSkillBySlashTrigger('missing')).toBeNull();
  });
});

describe('NETIOR_MCP_TOOL_SPECS', () => {
  it('exposes new domain tool specs', () => {
    const spec = getNetiorMcpToolSpec('instance_create');

    expect(spec).not.toBeNull();
    expect(spec?.key).toBe('instance_create');
    expect(spec?.category).toBe('instance');
    expect(spec?.kind).toBe('mutation');
  });

  it('builds Narre tool metadata from the shared registry', () => {
    const metadata = getNarreToolMetadata('model_summary');

    expect(metadata.displayName).toBe('Model Summary');
    expect(metadata.category).toBe('model');
    expect(metadata.kind).toBe('analysis');
    expect(metadata.isMutation).toBe(false);
  });

  it('does not expose removed legacy tool specs', () => {
    expect(getNetiorMcpToolSpec('create_schema')).toBeNull();
    expect(getNetiorMcpToolSpec('validate_dsl')).toBeNull();
    expect(getNetiorMcpToolSpec('create_interactive_view_template')).toBeNull();
  });

  it('lists registered MCP tool specs', () => {
    const specs = listNetiorMcpToolSpecs();
    expect(specs.length).toBeGreaterThan(30);
  });
});
