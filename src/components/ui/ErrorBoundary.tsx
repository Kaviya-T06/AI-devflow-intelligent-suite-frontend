import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="glass-card max-w-lg w-full p-8 text-center space-y-4 border border-danger-500/30">
            <div className="w-14 h-14 mx-auto rounded-full bg-danger-500/15 flex items-center justify-center text-2xl text-danger-400">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-surface-100">Something went wrong</h2>
            <p className="text-surface-400 text-sm">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-surface-900/80 rounded border border-surface-800 text-left text-xs font-mono text-danger-300 max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => window.history.back()}
                className="btn-secondary text-xs px-4 py-2"
              >
                Go Back
              </button>
              <button
                onClick={this.handleReset}
                className="btn-primary text-xs px-4 py-2"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
