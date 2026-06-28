import { registerWorldIpc } from './world-ipc';
import { registerFsIpc } from './fs-ipc';
import { registerPtyIpc } from './pty-ipc';
import { registerConfigIpc } from './config-ipc';
import { registerNarreIpc } from './narre-ipc';
import { registerAgentDefinitionIpc } from './agent-definition-ipc';
import { registerNetiorRpcIpc } from './netior-rpc-ipc';

export function registerAllIpc(): void {
  registerNetiorRpcIpc();
  registerWorldIpc();
  registerFsIpc();
  registerPtyIpc();
  registerConfigIpc();
  registerNarreIpc();
  registerAgentDefinitionIpc();
}
