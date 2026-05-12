import React, { useMemo } from 'react';
import * as ts from 'typescript';
import * as InteractiveSdk from './InteractiveViewRuntime';

interface DynamicInteractiveViewProps {
  sourceCode: string;
}

interface DynamicInteractiveViewState {
  error: Error | null;
}

type DynamicViewComponent = React.ComponentType;

class DynamicInteractiveViewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  DynamicInteractiveViewState
> {
  state: DynamicInteractiveViewState = { error: null };

  static getDerivedStateFromError(error: Error): DynamicInteractiveViewState {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-status-error bg-surface-card px-3 py-2 text-sm text-default">
          <div className="font-medium text-status-error">Interactive view crashed</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted">
            {this.state.error.message}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function compileInteractiveView(sourceCode: string): DynamicViewComponent {
  const compiled = ts.transpileModule(sourceCode, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      isolatedModules: true,
    },
    reportDiagnostics: true,
  });

  const errors = compiled.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
  }

  const module = { exports: {} as Record<string, unknown> };
  const exports = module.exports;
  const require = (moduleName: string): unknown => {
    if (moduleName === '@netior/interactive-sdk') return InteractiveSdk;
    if (moduleName === 'react') return React;
    throw new Error(`Import is not available in interactive view runtime: ${moduleName}`);
  };

  const evaluate = new Function('React', 'require', 'module', 'exports', compiled.outputText);
  evaluate(React, require, module, exports);

  const exported = module.exports as Record<string, unknown>;
  const component = exported.default ?? exported.View ?? exported.InteractiveView;
  if (typeof component !== 'function') {
    throw new Error('Interactive view source must export a React component named View, InteractiveView, or default.');
  }

  return component as DynamicViewComponent;
}

export function DynamicInteractiveView({ sourceCode }: DynamicInteractiveViewProps): JSX.Element {
  const result = useMemo(() => {
    try {
      return { Component: compileInteractiveView(sourceCode), error: null as Error | null };
    } catch (error) {
      return { Component: null, error: error as Error };
    }
  }, [sourceCode]);

  if (result.error) {
    return (
      <div className="rounded-lg border border-status-error bg-surface-card px-3 py-2 text-sm text-default">
        <div className="font-medium text-status-error">Interactive view could not be loaded</div>
        <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted">
          {result.error.message}
        </div>
      </div>
    );
  }

  const Component = result.Component as DynamicViewComponent;
  return (
    <DynamicInteractiveViewErrorBoundary>
      <Component />
    </DynamicInteractiveViewErrorBoundary>
  );
}
