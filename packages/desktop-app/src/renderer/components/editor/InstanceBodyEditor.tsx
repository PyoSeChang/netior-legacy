import React from 'react';
import { NetiorEditor } from './netior/NetiorEditor';

interface InstanceBodyEditorProps {
  tabId: string;
  content: string;
  projectId?: string | null;
  instanceId?: string | null;
  onChange: (content: string) => void;
}

export function InstanceBodyEditor({ tabId, content, projectId, instanceId, onChange }: InstanceBodyEditorProps): JSX.Element {
  return (
    <div className="min-h-[360px]">
      <NetiorEditor
        tabId={`${tabId}:instance-body`}
        content={content}
        projectId={projectId}
        instanceId={instanceId}
        onChange={onChange}
      />
    </div>
  );
}
