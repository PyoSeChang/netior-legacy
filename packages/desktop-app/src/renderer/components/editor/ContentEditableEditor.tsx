import React, { useRef, useCallback, useEffect } from 'react';

interface ContentEditableEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  singleLine?: boolean;
}

const DEBOUNCE_MS = 300;

export function ContentEditableEditor({
  value,
  onChange,
  placeholder,
  className = '',
  style,
  singleLine = false,
}: ContentEditableEditorProps): JSX.Element {
  const divRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!divRef.current) return;
    const text = divRef.current.innerText ?? '';
    const normalized = singleLine ? text.replace(/\n/g, '') : text;
    if (normalized !== lastEmittedRef.current) {
      lastEmittedRef.current = normalized;
      onChange(normalized);
    }
  }, [onChange, singleLine]);

  // Sync external value ??DOM (only when value differs from what we last emitted)
  useEffect(() => {
    if (!divRef.current) return;
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      divRef.current.innerText = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (!divRef.current) return;
    const text = divRef.current.innerText ?? '';

    // Clean up stale <br> so :empty placeholder works
    if (text === '' || text === '\n') {
      divRef.current.innerHTML = '';
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, singleLine ? text.replace(/\n/g, '') : text);
  }, [singleLine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent Enter in single-line mode
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
    }
  }, [singleLine]);

  const handleBlur = useCallback(() => {
    flush();
  }, [flush]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={`outline-none whitespace-pre-wrap break-words ${className}`}
      style={style}
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
}
