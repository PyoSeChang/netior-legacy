import fs from 'fs/promises';
import path from 'path';
import { normalizeNetiorToolName } from '@netior/shared/constants';

interface WorldApprovalGrant {
  operationKey: string;
  decision: 'allow';
  scope: 'world';
  createdAt: string;
}

interface WorldApprovalFileV1 {
  version: 1;
  allowedTools: string[];
}

interface WorldApprovalFileV2 {
  version: 2;
  grants: WorldApprovalGrant[];
}

type WorldApprovalFile = WorldApprovalFileV1 | WorldApprovalFileV2;

const LEGACY_OPERATION_KEYS: Record<string, string> = {
  create_concept: 'create_instance',
  update_concept: 'update_instance',
  delete_concept: 'delete_instance',
  upsert_concept_property: 'upsert_instance_property',
};

function createEmptyApprovalFile(): WorldApprovalFileV2 {
  return {
    version: 2,
    grants: [],
  };
}

function normalizeApprovalOperationKey(operationKey: string): string {
  const normalized = normalizeNetiorToolName(operationKey);
  return LEGACY_OPERATION_KEYS[normalized] ?? normalized;
}

function isAllowedApprovalScope(scope: unknown): scope is 'world' | 'project' {
  return scope === 'world' || scope === 'project';
}

export class ApprovalStore {
  constructor(private readonly dataDir: string) {}

  private worldDir(rootNetworkId: string): string {
    return path.join(this.dataDir, 'narre', rootNetworkId);
  }

  private approvalsPath(rootNetworkId: string): string {
    return path.join(this.worldDir(rootNetworkId), 'approvals.json');
  }

  private async ensureDir(rootNetworkId: string): Promise<void> {
    await fs.mkdir(this.worldDir(rootNetworkId), { recursive: true });
  }

  private async readApprovalFile(rootNetworkId: string): Promise<WorldApprovalFileV2> {
    try {
      const raw = await fs.readFile(this.approvalsPath(rootNetworkId), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<WorldApprovalFile>;
      if (parsed.version === 2 && Array.isArray((parsed as Partial<WorldApprovalFileV2>).grants)) {
        return {
          version: 2,
          grants: (parsed as Partial<WorldApprovalFileV2>).grants!
            .filter((grant): grant is WorldApprovalGrant =>
              Boolean(grant)
              && typeof grant.operationKey === 'string'
              && grant.operationKey.trim().length > 0
              && grant.decision === 'allow'
              && isAllowedApprovalScope(grant.scope)
              && typeof grant.createdAt === 'string'
              && grant.createdAt.trim().length > 0,
            )
            .map((grant) => ({
              ...grant,
              operationKey: normalizeApprovalOperationKey(grant.operationKey),
              scope: 'world',
            })),
        };
      }

      if (parsed.version === 1 && Array.isArray((parsed as Partial<WorldApprovalFileV1>).allowedTools)) {
        return {
          version: 2,
          grants: (parsed as Partial<WorldApprovalFileV1>).allowedTools!
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => ({
              operationKey: normalizeApprovalOperationKey(value),
              decision: 'allow' as const,
              scope: 'world' as const,
              createdAt: new Date(0).toISOString(),
            })),
        };
      }
    } catch {
      // fall through
    }

    return createEmptyApprovalFile();
  }

  private async writeApprovalFile(rootNetworkId: string, data: WorldApprovalFileV2): Promise<void> {
    await this.ensureDir(rootNetworkId);
    await fs.writeFile(this.approvalsPath(rootNetworkId), JSON.stringify(data, null, 2), 'utf-8');
  }

  async isOperationAllowed(rootNetworkId: string, operationKey: string): Promise<boolean> {
    const file = await this.readApprovalFile(rootNetworkId);
    const normalizedOperationKey = normalizeApprovalOperationKey(operationKey);
    return file.grants.some((grant) => grant.operationKey === normalizedOperationKey && grant.decision === 'allow');
  }

  async allowOperation(rootNetworkId: string, operationKey: string): Promise<void> {
    const file = await this.readApprovalFile(rootNetworkId);
    const normalizedOperationKey = normalizeApprovalOperationKey(operationKey);
    if (file.grants.some((grant) => grant.operationKey === normalizedOperationKey && grant.decision === 'allow')) {
      return;
    }

    file.grants.push({
      operationKey: normalizedOperationKey,
      decision: 'allow',
      scope: 'world',
      createdAt: new Date().toISOString(),
    });
    file.grants.sort((left, right) => left.operationKey.localeCompare(right.operationKey));
    await this.writeApprovalFile(rootNetworkId, file);
  }

  async isToolAllowed(rootNetworkId: string, toolName: string): Promise<boolean> {
    return this.isOperationAllowed(rootNetworkId, toolName);
  }

  async allowTool(rootNetworkId: string, toolName: string): Promise<void> {
    await this.allowOperation(rootNetworkId, toolName);
  }
}
