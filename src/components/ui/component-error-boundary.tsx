"use client";

import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { LanguageContext } from "@/lib/i18n/provider";
import type { LanguageContextValue } from "@/lib/i18n/provider";
import { clientLogger } from "@/lib/client-logger";

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  // Incremented on every retry and used as the `key` on the children
  // wrapper below. Changing the key forces React to unmount and recreate
  // the child subtree from scratch, rather than reusing the fiber (and
  // any stale/corrupted instance state) that existed before the crash.
  // This is self-contained: the boundary owns its own retry counter, so
  // no caller needs to pass a resettable key.
  retryKey: number;
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  static contextType = LanguageContext;
  declare context: LanguageContextValue | null;

  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryKey: 0 };
  }

  static getDerivedStateFromError(): Pick<ComponentErrorBoundaryState, "hasError"> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    clientLogger.error("[COMPONENT_ERROR_BOUNDARY]", { error: error instanceof Error ? error.message : String(error), componentStack: errorInfo?.componentStack });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState((prevState) => ({
      hasError: false,
      retryKey: prevState.retryKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const t = this.context?.t ?? ((key: string) => key);

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p className="text-sm text-white/70">{t("errors.generic_title")}</p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {t("errors.retry")}
          </button>
        </div>
      );
    }

    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}
