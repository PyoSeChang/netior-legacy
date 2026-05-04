import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WINDOWS_FONT_SUFFIX_PATTERN = /\s+\((TrueType|OpenType|All res|Variable font|Raster|VGA res)\)$/i;
const WINDOWS_POWERSHELL_COMMAND = [
  "$paths = @(",
  "  'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',",
  "  'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'",
  ");",
  "$names = foreach ($path in $paths) {",
  "  if (Test-Path $path) {",
  "    (Get-ItemProperty -Path $path).PSObject.Properties |",
  "      Where-Object { $_.Name -notmatch '^PS(Path|ParentPath|ChildName|Drive|Provider)$' } |",
  "      ForEach-Object { ($_.Name -replace '\\s+\\((TrueType|OpenType|All res|Variable font|Raster|VGA res)\\)$', '').Trim() }",
  "  }",
  "}",
  "$names | Sort-Object -Unique | ConvertTo-Json -Compress",
].join(' ');

let cachedSystemFontsPromise: Promise<string[]> | null = null;

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort((a, b) => a.localeCompare(b));
}

function splitFamilyList(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseJsonFontList(stdout: string): string[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  const parsed = JSON.parse(trimmed) as string | string[];
  if (Array.isArray(parsed)) {
    return uniqueSorted(parsed);
  }

  return uniqueSorted([parsed]);
}

async function listWindowsFonts(): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-Command', WINDOWS_POWERSHELL_COMMAND],
    {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    },
  );

  return uniqueSorted(
    parseJsonFontList(stdout).map((name) => name.replace(WINDOWS_FONT_SUFFIX_PATTERN, '').trim()),
  );
}

async function listMacFonts(): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'system_profiler',
    ['SPFontsDataType', '-json'],
    { maxBuffer: 12 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as { SPFontsDataType?: Array<{ _name?: string }> };
  return uniqueSorted((parsed.SPFontsDataType ?? []).map((font) => font._name ?? ''));
}

async function listLinuxFonts(): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'fc-list',
    ['-f', '%{family}\n'],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  return uniqueSorted(stdout.split(/\r?\n/).flatMap(splitFamilyList));
}

async function loadSystemFonts(): Promise<string[]> {
  if (process.platform === 'win32') {
    return listWindowsFonts();
  }

  if (process.platform === 'darwin') {
    return listMacFonts();
  }

  return listLinuxFonts();
}

export async function listSystemFonts(): Promise<string[]> {
  if (!cachedSystemFontsPromise) {
    cachedSystemFontsPromise = loadSystemFonts().catch((error) => {
      cachedSystemFontsPromise = null;
      throw error;
    });
  }

  return cachedSystemFontsPromise;
}
