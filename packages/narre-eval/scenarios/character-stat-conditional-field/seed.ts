import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  const project = await ctx.createProject({
    name: 'Character Stat Conditional Field Fixture',
    root_dir: ctx.tempDir,
  });
  await ctx.createModule({
    project_id: project.id,
    name: 'Ontology',
    path: ctx.tempDir,
  });

  ctx.setTemplateVars({
    project_id: project.id,
  });
}
