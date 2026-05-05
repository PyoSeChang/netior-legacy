const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopPackageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopPackageRoot, '..', '..');
const packageManagerExec = process.env.npm_execpath;
const packagedSidecarsRoot = path.join(desktopPackageRoot, 'resources', 'packaged-sidecars');

const sidecarTargets = [
  {
    name: 'service',
    packageName: '@netior/service',
    source: path.join(repoRoot, 'packages', 'netior-service', 'dist'),
    destinationRoot: path.join(packagedSidecarsRoot, 'netior-service'),
    nativeArtifacts: [
      {
        packageId: 'better-sqlite3',
        relativeSourcePath: path.join('build', 'Release', 'better_sqlite3.node'),
        relativeDestinationPath: path.join(
          'node_modules',
          '@netior',
          'core',
          'node_modules',
          'better-sqlite3',
          'build',
          'Release',
          'better_sqlite3.node',
        ),
      },
    ],
  },
  {
    name: 'narre-server',
    packageName: '@netior/narre-server',
    source: path.join(repoRoot, 'packages', 'narre-server', 'dist'),
    destinationRoot: path.join(packagedSidecarsRoot, 'narre-server'),
    copyDistOnly: true,
    runtimeFiles: [
      {
        packageId: '@anthropic-ai/claude-agent-sdk',
        relativeSourcePath: 'cli.js',
        relativeDestinationPath: path.join('vendor', 'claude-agent-sdk', 'cli.js'),
      },
    ],
  },
  {
    name: 'netior-mcp',
    packageName: '@netior/mcp',
    source: path.join(repoRoot, 'packages', 'netior-mcp', 'dist'),
    destinationRoot: path.join(packagedSidecarsRoot, 'netior-mcp'),
    copyDistOnly: true,
  },
];

const SKIPPED_NODE_MODULE_ENTRIES = new Set(['.bin', '.pnpm']);
const SKIPPED_PACKAGE_DIR_NAMES = new Set([
  '.github',
  '__tests__',
  '__mocks__',
  'coverage',
  'docs',
  'doc',
  'example',
  'examples',
  'fixture',
  'fixtures',
  'spec',
  'specs',
  'test',
  'tests',
  'website',
]);
const SKIPPED_PACKAGE_FILE_EXTENSIONS = new Set([
  '.cts',
  '.map',
  '.markdown',
  '.md',
  '.mts',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const SKIPPED_PACKAGE_FILE_PATTERNS = [
  /^CHANGELOG/i,
  /^CONTRIBUTING/i,
  /^HISTORY/i,
  /^README/i,
];

function shouldSkipNodeModulesEntry(entry) {
  return SKIPPED_NODE_MODULE_ENTRIES.has(entry.name) || entry.name.startsWith('.') || !(entry.isDirectory() || entry.isSymbolicLink());
}

function shouldCopyPackagePath(copyPath) {
  const baseName = path.basename(copyPath);
  const normalizedBaseName = baseName.toLowerCase();

  if (SKIPPED_PACKAGE_DIR_NAMES.has(normalizedBaseName)) {
    return false;
  }

  const extension = path.extname(baseName).toLowerCase();
  if (extension && SKIPPED_PACKAGE_FILE_EXTENSIONS.has(extension)) {
    return false;
  }

  if (extension === '.md' || extension === '.markdown') {
    return !SKIPPED_PACKAGE_FILE_PATTERNS.some((pattern) => pattern.test(baseName));
  }

  return !SKIPPED_PACKAGE_FILE_PATTERNS.some((pattern) => pattern.test(baseName));
}

function getPackagePlacement(realSourcePath) {
  let currentPath = path.dirname(realSourcePath);

  while (true) {
    if (path.basename(currentPath) === 'node_modules') {
      const relativeSegments = path.relative(currentPath, realSourcePath).split(path.sep).filter(Boolean);
      if (relativeSegments.length === 0) {
        return null;
      }

      if (relativeSegments[0].startsWith('@') && relativeSegments.length >= 2) {
        return {
          parentNodeModulesPath: currentPath,
          packageId: `${relativeSegments[0]}/${relativeSegments[1]}`,
        };
      }

      return {
        parentNodeModulesPath: currentPath,
        packageId: relativeSegments[0],
      };
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }
    currentPath = parentPath;
  }
}

function materializeSidecar(stagingRoot, destinationRoot) {
  fs.rmSync(destinationRoot, { recursive: true, force: true });
  fs.mkdirSync(destinationRoot, { recursive: true });

  for (const entry of fs.readdirSync(stagingRoot, { withFileTypes: true })) {
    const sourcePath = path.join(stagingRoot, entry.name);
    const destinationPath = path.join(destinationRoot, entry.name);

    if (entry.name === 'node_modules') {
      materializeNodeModules(sourcePath, destinationPath, new Set());
      continue;
    }

    fs.cpSync(sourcePath, destinationPath, {
      recursive: true,
      force: true,
      dereference: true,
    });
  }
}

function findInstalledPackageRoot(packageId) {
  const packageSegments = packageId.split('/');
  const candidateNodeModulesRoots = [
    path.join(repoRoot, 'node_modules'),
    ...fs.readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(repoRoot, 'packages', entry.name, 'node_modules')),
  ];

  for (const nodeModulesRoot of candidateNodeModulesRoots) {
    const directPath = path.join(nodeModulesRoot, ...packageSegments);
    if (fs.existsSync(path.join(directPath, 'package.json'))) {
      return directPath;
    }
  }

  const normalizedPackageId = packageId.replace('@', '').replace('/', '+');
  for (const nodeModulesRoot of candidateNodeModulesRoots) {
    const virtualStorePaths = ['.pnpm', '.pnpm-codex']
      .map((storeName) => path.join(nodeModulesRoot, storeName))
      .filter((storePath) => fs.existsSync(storePath));

    for (const virtualStorePath of virtualStorePaths) {
      for (const entry of fs.readdirSync(virtualStorePath, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith(`${normalizedPackageId}@`)) {
          continue;
        }

        const candidatePath = path.join(virtualStorePath, entry.name, 'node_modules', ...packageSegments);
        if (fs.existsSync(path.join(candidatePath, 'package.json'))) {
          return candidatePath;
        }
      }
    }
  }

  return null;
}

function rehydrateNativeArtifacts(destinationRoot, nativeArtifacts) {
  for (const artifact of nativeArtifacts ?? []) {
    const packageRoot = findInstalledPackageRoot(artifact.packageId);
    if (!packageRoot) {
      throw new Error(`[prepare-sidecars] Could not resolve package root for ${artifact.packageId}`);
    }

    const sourcePath = path.join(packageRoot, artifact.relativeSourcePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`[prepare-sidecars] Missing native artifact for ${artifact.packageId}: ${sourcePath}`);
    }

    const destinationPath = path.join(destinationRoot, artifact.relativeDestinationPath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function copyRuntimeFiles(destinationRoot, runtimeFiles) {
  for (const runtimeFile of runtimeFiles ?? []) {
    const packageRoot = findInstalledPackageRoot(runtimeFile.packageId);
    if (!packageRoot) {
      throw new Error(`[prepare-sidecars] Could not resolve package root for ${runtimeFile.packageId}`);
    }

    const sourcePath = path.join(packageRoot, runtimeFile.relativeSourcePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`[prepare-sidecars] Missing runtime file for ${runtimeFile.packageId}: ${sourcePath}`);
    }

    const destinationPath = path.join(destinationRoot, runtimeFile.relativeDestinationPath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function materializeNodeModules(sourceNodeModulesPath, destinationNodeModulesPath, seen) {
  if (!fs.existsSync(sourceNodeModulesPath)) {
    return;
  }

  fs.mkdirSync(destinationNodeModulesPath, { recursive: true });

  for (const entry of fs.readdirSync(sourceNodeModulesPath, { withFileTypes: true })) {
    if (shouldSkipNodeModulesEntry(entry)) {
      continue;
    }

    materializeDependencyEntry(
      path.join(sourceNodeModulesPath, entry.name),
      path.join(destinationNodeModulesPath, entry.name),
      seen,
    );
  }
}

function getPackagePath(nodeModulesPath, packageId) {
  if (!nodeModulesPath) {
    return null;
  }

  const packagePath = path.join(nodeModulesPath, ...packageId.split('/'));
  return fs.existsSync(packagePath) ? packagePath : null;
}

function getDirectRuntimeDependencyIds(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return Array.from(new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]));
}

function materializeDependencyEntry(sourcePath, destinationPath, seen) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const realSourcePath = fs.realpathSync(sourcePath);
  const entryName = path.basename(sourcePath);
  const packageJsonPath = path.join(realSourcePath, 'package.json');

  if (entryName.startsWith('@') && !fs.existsSync(packageJsonPath)) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const child of fs.readdirSync(realSourcePath, { withFileTypes: true })) {
      if (shouldSkipNodeModulesEntry(child)) {
        continue;
      }

      materializeDependencyEntry(
        path.join(realSourcePath, child.name),
        path.join(destinationPath, child.name),
        seen,
      );
    }
    return;
  }

  const seenKey = `${realSourcePath}::${destinationPath}`;
  if (seen.has(seenKey)) {
    return;
  }
  seen.add(seenKey);

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(realSourcePath, destinationPath, {
    recursive: true,
    force: true,
    dereference: true,
    filter: (copyPath) => path.basename(copyPath) !== 'node_modules' && shouldCopyPackagePath(copyPath),
  });

  const placement = getPackagePlacement(realSourcePath);
  if (!placement) {
    return;
  }

  const nestedNodeModulesPath = path.join(destinationPath, 'node_modules');
  for (const dependencyId of getDirectRuntimeDependencyIds(packageJsonPath)) {
    if (dependencyId === placement.packageId) {
      continue;
    }

    const dependencySourcePath = getPackagePath(placement.parentNodeModulesPath, dependencyId);
    if (!dependencySourcePath) {
      continue;
    }

    materializeDependencyEntry(
      dependencySourcePath,
      path.join(nestedNodeModulesPath, ...dependencyId.split('/')),
      seen,
    );
  }
}

for (const sidecar of sidecarTargets) {
  if (!fs.existsSync(sidecar.source)) {
    throw new Error(
      `[prepare-sidecars] Missing build output for ${sidecar.name}: ${sidecar.source}. ` +
      `Run the package build first.`,
    );
  }

  const stagingRoot = path.join(os.tmpdir(), 'netior-sidecars-staging', sidecar.name);
  fs.rmSync(sidecar.destinationRoot, { recursive: true, force: true });
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(sidecar.destinationRoot), { recursive: true });

  if (sidecar.copyDistOnly) {
    fs.mkdirSync(path.join(sidecar.destinationRoot, 'dist'), { recursive: true });
    fs.cpSync(sidecar.source, path.join(sidecar.destinationRoot, 'dist'), {
      recursive: true,
      force: true,
      dereference: true,
    });
    copyRuntimeFiles(sidecar.destinationRoot, sidecar.runtimeFiles);
    console.log(`[prepare-sidecars] Copied bundled ${sidecar.name}`);
    console.log(`[prepare-sidecars] Target: ${sidecar.destinationRoot}`);
    continue;
  }

  if (!packageManagerExec) {
    throw new Error('[prepare-sidecars] npm_execpath is not set');
  }
  execFileSync(
    process.execPath,
    [packageManagerExec, '--ignore-scripts', '--filter', sidecar.packageName ?? `@netior/${sidecar.name}`, 'deploy', '--prod', stagingRoot],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  materializeSidecar(stagingRoot, sidecar.destinationRoot);
  rehydrateNativeArtifacts(sidecar.destinationRoot, sidecar.nativeArtifacts);
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  console.log(`[prepare-sidecars] Deployed ${sidecar.name}`);
  console.log(`[prepare-sidecars] Source package: @netior/${sidecar.name}`);
  console.log(`[prepare-sidecars] Target: ${sidecar.destinationRoot}`);
}
