import { registerProjectIpc } from './project-ipc';
import { registerInstanceIpc } from './instance-ipc';
import { registerNetworkIpc } from './network-ipc';
import { registerLayoutIpc } from './layout-ipc';
import { registerFileIpc } from './file-ipc';
import { registerFsIpc } from './fs-ipc';
import { registerModuleIpc } from './module-ipc';
import { registerEditorPrefsIpc } from './editor-prefs-ipc';
import { registerSchemaIpc } from './schema-ipc';
import { registerInstancePropertyIpc } from './instance-property-ipc';
import { registerInstanceContentIpc } from './instance-content-ipc';
import { registerPtyIpc } from './pty-ipc';
import { registerConfigIpc } from './config-ipc';
import { registerModelIpc } from './model-ipc';
import { registerObjectIpc } from './object-ipc';
import { registerNarreIpc } from './narre-ipc';
import { registerContextIpc } from './context-ipc';
import { registerAgentDefinitionIpc } from './agent-definition-ipc';

export function registerAllIpc(): void {
  registerProjectIpc();
  registerInstanceIpc();
  registerNetworkIpc();
  registerLayoutIpc();
  registerFileIpc();
  registerFsIpc();
  registerModuleIpc();
  registerEditorPrefsIpc();
  registerSchemaIpc();
  registerInstancePropertyIpc();
  registerInstanceContentIpc();
  registerPtyIpc();
  registerConfigIpc();
  registerModelIpc();
  registerObjectIpc();
  registerNarreIpc();
  registerContextIpc();
  registerAgentDefinitionIpc();
}
