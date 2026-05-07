import React from 'react';
import { MarkdownEditor } from './markdown/MarkdownEditor';

interface InstanceBodyEditorProps {
  tabId: string;
  content: string;
  onChange: (content: string) => void;
}

export function InstanceBodyEditor({ tabId, content, onChange }: InstanceBodyEditorProps): JSX.Element {
  return (
    <div className="h-[min(70vh,720px)] min-h-[360px] overflow-hidden">
      <MarkdownEditor
        tabId={`${tabId}:instance-body`}
        content={content}
        onChange={onChange}
      />
    </div>
  );
}
