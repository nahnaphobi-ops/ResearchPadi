import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../../utils/errorTracking';
import { dismissSplash } from '../../utils/splash';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Catches a crash while a page renders, reports it, and offers a reload instead of a blank
 * screen. The common cause after a deploy is a page file that no longer exists; a reload
 * fetches the new one.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack ?? undefined);
    // A crash on the first page would otherwise leave the intro covering this message.
    dismissSplash();
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-navy-mist px-5 text-center" role="alert">
        <p className="text-xl font-bold text-navy mb-2">Something went wrong</p>
        <p className="text-sm text-muted mb-8 max-w-sm">This page could not be shown. Reload it to try again.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary px-6 py-3 text-sm">
            Reload page
          </button>
          <a href="/" className="btn-ghost px-6 py-3 text-sm">
            Go to homepage
          </a>
        </div>
      </div>
    );
  }
}
