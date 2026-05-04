import React from 'react';
import { ContentEditableEditor } from './ContentEditableEditor';

interface ConceptBodyEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function ConceptBodyEditor({ content, onChange }: ConceptBodyEditorProps): JSX.Element {
  return (
    <ContentEditableEditor
      value={content}
      onChange={onChange}
      placeholder="Write something..."
      className="min-h-[120px] text-default"
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--font-body-size)',
        lineHeight: 'var(--font-body-line-height)',
        letterSpacing: 'var(--font-body-letter-spacing)',
      }}
    />
  );
}
