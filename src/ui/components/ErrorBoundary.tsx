import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public handleReset = (): void => {
    try {
      this.state = { hasError: false, error: null };
      try {
        const updater = (this as unknown as { updater?: { isMounted?: (c: unknown) => boolean } }).updater;
        if (!updater?.isMounted || updater.isMounted(this)) {
          this.setState({ hasError: false, error: null });
        }
      } catch {
        // Safe in unmounted or testing context
      }
      this.props.onReset?.();
    } catch (err) {
      console.error('Error during ErrorBoundary reset:', err);
      // Hard reload fallback
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] w-full p-6 flex items-center justify-center bg-slate-950 text-slate-100">
          <div className="max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
              An unexpected game error occurred
            </h2>

            <p className="text-sm text-slate-400 mb-4">
              The game interface encountered an issue. You can restore the session without losing your setup.
            </p>

            {this.state.error && (
              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left mb-6 overflow-x-auto text-xs font-mono text-red-300">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recover & Restart Game</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
