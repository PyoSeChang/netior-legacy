import React from 'react';

export function NetiorTitleMark({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <g stroke="currentColor" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
        <path d="M132 170L256 108L380 170" />
        <path d="M132 342L256 404L380 342" />
        <path d="M132 170V342" opacity="0.72" />
        <path d="M380 170V342" opacity="0.72" />
        <path d="M256 108V404" opacity="0.46" />
        <path d="M132 170L256 256L380 170" />
        <path d="M132 342L256 256L380 342" />
        <path d="M132 170H380" opacity="0.36" />
        <path d="M132 342H380" opacity="0.36" />
      </g>
      <g fill="currentColor">
        <circle cx="132" cy="170" r="26" />
        <circle cx="256" cy="108" r="24" />
        <circle cx="380" cy="170" r="26" />
        <circle cx="256" cy="256" r="34" />
        <circle cx="132" cy="342" r="26" />
        <circle cx="256" cy="404" r="24" />
        <circle cx="380" cy="342" r="26" />
      </g>
      <g fill="var(--color-accent, currentColor)">
        <circle cx="256" cy="256" r="14" />
        <circle cx="256" cy="108" r="10" />
        <circle cx="256" cy="404" r="10" />
      </g>
    </svg>
  );
}

export function AppChromeMark(): JSX.Element {
  if (import.meta.env.DEV) {
    return (
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
        DEV
      </span>
    );
  }

  return <NetiorTitleMark />;
}
