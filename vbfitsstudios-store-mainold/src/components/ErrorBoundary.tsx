import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // If it's a chunk load error, automatically reload the page once
    if (error.message && /Loading chunk [\d]+ failed|Failed to fetch dynamically imported module/i.test(error.message)) {
      const reloadCount = sessionStorage.getItem('chunk_reload_count') || '0';
      if (parseInt(reloadCount, 10) < 2) {
        sessionStorage.setItem('chunk_reload_count', (parseInt(reloadCount, 10) + 1).toString());
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-6 max-w-md">
            We encountered an unexpected error. This usually happens when the application has been updated.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem('chunk_reload_count');
              window.location.reload();
            }}
            className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest font-semibold hover:bg-gray-800 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
