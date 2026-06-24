import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  await ctx.createWorld({
    name: 'Foreshadowing Model Workshop',
    root_dir: ctx.tempDir,
  });
}
