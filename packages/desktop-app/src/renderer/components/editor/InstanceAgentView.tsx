import React from 'react';

interface InstanceAgentViewProps {
  instanceId: string;
  agentContent: string | null;
}

export function InstanceAgentView({ instanceId, agentContent }: InstanceAgentViewProps): JSX.Element {
  return (
    <textarea
      className="h-full w-full resize-none bg-surface-editor p-4 font-mono text-sm text-default outline-none placeholder:text-muted"
      value={agentContent ?? ''}
      readOnly
      aria-label={`instance-agent-${instanceId}`}
      placeholder="Agent content will appear here..."
      spellCheck={false}
    />
  );
}
