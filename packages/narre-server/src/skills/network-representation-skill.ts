import type { NarreSkillDefinition } from './types.js';

function buildNetworkRepresentationPrompt(): string {
  return `## Active Skill: Network Representation Authoring
You are designing how a Netior network represents ontology-backed objects on a work surface.

Required workflow:
1. Identify whether the request is about ontology, instance data, graph placement, or representation grammar.
2. Before creating or restructuring a network, choose an existing network type or create a user-defined network type.
3. Call list_network_representation_primitives before authoring custom network, node, or edge types.
4. Use network type for the work surface, node type for object presentation, and edge type for relation presentation.
5. Do not encode node card display, ports, routing, or edge presentation as schema fields.
6. Use schema/model changes only for user-supplied domain meaning. Do not define the user's domain, categories, workflows, or examples yourself.
7. Keep the output explicit about network types, node types, edge types, instances, models, edges, and unresolved choices.

Representation boundaries:
- schema/model defines ontology and meaning.
- network type defines the kind of work surface.
- node type and edge type define how objects and relations appear inside that surface.
- representation primitives are fixed system-provided surface runtimes, projection sources, ports, routing strategies, and visual slots.

Mutation policy:
- Prefer existing built-in/project network types when they fit.
- Create a user-defined type only when the requested surface needs a distinct representation grammar.
- Confirm before destructive changes or broad restructures.`;
}

export const networkRepresentationSkill: NarreSkillDefinition = {
  id: 'network-representation-authoring',
  name: 'network-representation',
  description: 'narre.command.networkRepresentation',
  source: 'builtin',
  trigger: { type: 'slash', name: 'network-representation' },
  hint: 'narre.command.networkRepresentationHint',
  additionalToolProfiles: ['network-representation-authoring'],
  buildPrompt: () => buildNetworkRepresentationPrompt(),
};
