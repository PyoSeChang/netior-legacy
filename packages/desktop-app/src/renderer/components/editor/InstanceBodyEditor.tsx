import React from 'react';
import { NetiorEditor } from './netior/NetiorEditor';

interface InstanceBodyEditorProps {
  tabId: string;
  content: string;
  rootNetworkId?: string | null;
  instanceId?: string | null;
  onChange: (content: string) => void;
}

export function InstanceBodyEditor({ tabId, content, rootNetworkId, instanceId, onChange }: InstanceBodyEditorProps): JSX.Element {
  return (
    <div className="min-h-[360px]">
      <NetiorEditor
        tabId={`${tabId}:instance-body`}
        content={content}
        rootNetworkId={rootNetworkId}
        instanceId={instanceId}
        onChange={onChange}
      />
    </div>
  );
}
