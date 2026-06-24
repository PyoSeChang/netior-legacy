import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  await ctx.createWorld({
    name: 'Fantasy World Atlas',
    root_dir: ctx.tempDir,
  });
}
