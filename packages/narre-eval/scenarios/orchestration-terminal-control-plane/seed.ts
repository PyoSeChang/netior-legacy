import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  await ctx.createWorld({
    name: 'Orchestration Control Plane Fixture',
    root_dir: ctx.tempDir,
  });
}
