import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useInstanceStore } from '../../stores/instance-store';

interface InstanceAgentViewProps {
  instanceId: string;
  agentContent: string | null;
}

const DEBOUNCE_MS = 500;

export function InstanceAgentView({ instanceId, agentContent }: InstanceAgentViewProps): JSX.Element {
  const [localValue, setLocalValue] = useState(agentContent ?? '');
  const updateAgentContent = useInstanceStore((s) => s.updateAgentContent);
  const isFocusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external prop ??local state (only when not actively editing)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(agentContent ?? '');
    }
  }, [agentContent]);

  const flush = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      updateAgentContent(instanceId, value);
    },
    [instanceId, updateAgentContent],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => flush(val), DEBOUNCE_MS);
    },
    [flush],
  );

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    flush(localValue);
  }, [flush, localValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <textarea
      className="h-full w-full resize-none bg-surface-editor p-4 font-mono text-sm text-default outline-none placeholder:text-muted"
      value={localValue}
      onChange={handleChange}
      onFocus={() => { isFocusedRef.current = true; }}
      onBlur={handleBlur}
      placeholder="Agent content will appear here..."
      spellCheck={false}
    />
  );
}
