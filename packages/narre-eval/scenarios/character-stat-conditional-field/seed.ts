import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  const world = await ctx.createWorld({
    name: 'Character Stat Conditional Field Fixture',
    root_dir: ctx.tempDir,
  });
  await ctx.createModule({
    root_network_id: world.id,
    name: 'Ontology',
    path: ctx.tempDir,
  });

  ctx.setTemplateVars({
    root_network_id: world.id,
  });
}
