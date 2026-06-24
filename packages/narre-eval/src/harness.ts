import { existsSync, unlinkSync, mkdirSync, cpSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type { SeedContext } from './types.js';
import {
  createInstance,
  createSchema,
  createSchemaField,
  createFileEntity,
  createModule,
  createWorld,
  getWorldById,
  createMeaning,
  upsertInstanceProperty,
} from './netior-service-client.js';
import { startNetiorServiceForEval } from './netior-service-process.js';

let currentRunId: string | null = null;

export interface SetupResult {
  rootNetworkId: string;
  tempDir: string;
  dbPath: string;
  preserve: boolean;
  templateVars: Record<string, string>;
  serviceUrl: string;
  stopService: () => Promise<void>;
}

export interface SetupScenarioOptions {
  dbPath?: string;
  rootNetworkId?: string;
  preserve?: boolean;
}

export function getRunId(): string {
  if (!currentRunId) {
    currentRunId = randomUUID().slice(0, 8);
  }
  return currentRunId;
}

export function setRunId(runId: string): void {
  currentRunId = runId;
}

export async function setupScenario(
  scenarioDir: string,
  seedFn: (ctx: SeedContext) => Promise<void>,
  scenarioId: string,
  options: SetupScenarioOptions = {},
): Promise<SetupResult> {
  // Unique dir per setup call — safe under --repeat
  const uniqueSuffix = randomUUID().slice(0, 8);
  const tempDir = options.dbPath
    ? join(dirname(resolve(options.dbPath)), `narre-eval-${scenarioId}-${uniqueSuffix}`)
    : join(tmpdir(), `narre-eval-${scenarioId}-${uniqueSuffix}`);
  mkdirSync(tempDir, { recursive: true });

  // Per-scenario DB path inside temp dir
  const dbPath = options.dbPath ? resolve(options.dbPath) : join(tempDir, `${scenarioId}.db`);
  mkdirSync(dirname(dbPath), { recursive: true });

  if (!options.dbPath && existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const service = await startNetiorServiceForEval(dbPath);

  let rootNetworkId: string | null = options.rootNetworkId ?? null;
  let templateVars: Record<string, string> = {};
  const pendingOperations: Promise<unknown>[] = [];

  function track<T>(promise: Promise<T>): Promise<T> {
    pendingOperations.push(promise);
    return promise;
  }

  const ctx: SeedContext = {
    tempDir,
    scenarioDir,
    rootNetworkId: rootNetworkId ?? undefined,
    dbPath,
    preserve: options.preserve ?? false,
    async createWorld(data) {
      if (options.rootNetworkId) {
        const world = await track(getWorldById(service.baseUrl, options.rootNetworkId));
        if (!world) {
          throw new Error(`World not found for --root-network-id: ${options.rootNetworkId}`);
        }
        rootNetworkId = world.id;
        return world;
      }
      const world = await track(createWorld(service.baseUrl, {
        ...data,
        root_dir: data.root_dir || tempDir,
      }));
      rootNetworkId = world.id;
      return world;
    },
    createSchema(data) {
      return track(createSchema(service.baseUrl, data));
    },
    createSchemaField(data) {
      return track(createSchemaField(service.baseUrl, data));
    },
    createMeaning(data) {
      return track(createMeaning(service.baseUrl, data));
    },
    createInstance(data) {
      return track(createInstance(service.baseUrl, data));
    },
    upsertInstanceProperty(data) {
      return track(upsertInstanceProperty(service.baseUrl, data));
    },
    createFileEntity(data) {
      return track(createFileEntity(service.baseUrl, data));
    },
    createModule(data) {
      return track(createModule(service.baseUrl, data));
    },
    async copyFixtures() {
      const fixturesDir = join(scenarioDir, 'fixtures');
      if (!existsSync(fixturesDir)) {
        throw new Error(`fixtures/ directory not found in ${scenarioDir}`);
      }
      cpSync(fixturesDir, tempDir, { recursive: true });
    },
    setTemplateVars(vars) {
      templateVars = { ...templateVars, ...vars };
    },
  };

  try {
    await seedFn(ctx);
    await Promise.all(pendingOperations);

    if (!rootNetworkId) {
      throw new Error('seed function must call ctx.createWorld()');
    }

    return {
      rootNetworkId,
      tempDir,
      dbPath,
      preserve: options.preserve ?? false,
      templateVars,
      serviceUrl: service.baseUrl,
      stopService: service.stop,
    };
  } catch (error) {
    await service.stop();
    if (!options.preserve && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

export async function teardownScenario(
  setup: Pick<SetupResult, 'tempDir' | 'stopService'>,
  options: { preserve?: boolean } = {},
): Promise<void> {
  await setup.stopService();
  if (options.preserve) {
    return;
  }
  if (existsSync(setup.tempDir)) {
    await removeDirectoryWithRetry(setup.tempDir);
  }
}

async function removeDirectoryWithRetry(targetDir: string): Promise<void> {
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      rmSync(targetDir, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!existsSync(targetDir)) {
        return;
      }

      if ((code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY') && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        continue;
      }

      throw error;
    }
  }
}
