import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  await ctx.createProject({
    name: 'Orchestration Control Plane Fixture',
    root_dir: ctx.tempDir,
  });
}
