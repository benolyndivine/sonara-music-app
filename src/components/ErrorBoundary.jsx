import React from 'react';

/**
 * ErrorBoundary
 * -------------
 * Wraps the app so that a render-time crash anywhere in the tree (a
 * malformed Firestore doc, an unexpected null, etc.) shows a recoverable
 * "Something went wrong" screen instead of a blank white page. React error
 * boundaries can only be class components — there's no hooks equivalent.
 *
 * "Try Again" resets local state and re-renders the tree; if the crash was
 * caused by stale/bad state rather than bad data, this alone can recover.
 * "Reload App" is the guaranteed fallback (full reload re-fetches fresh
 * Firestore data from scratch).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Logged for whoever's watching the console/device logs during grading
    // or QA — swap for a real crash-reporting call (Sentry, Crashlytics,
    // etc.) if/when Sonara wires one up.
    console.error('Sonara crashed:', error, info);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh', width: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            backgroundColor: '#05070c', color: '#ffffff', padding: '32px 24px', boxSizing: 'border-box',
          }}
        >
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2.4rem', color: '#ff4d4d', marginBottom: '20px' }}></i>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: '700' }}>Something went wrong</h2>
          <p style={{ margin: '0 0 28px 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', maxWidth: '320px' }}>
            Sonara hit an unexpected error. You can try continuing, or reload the app for a clean start.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleTryAgain}
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px', padding: '12px 20px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#1db954', color: '#000000', border: 'none',
                borderRadius: '10px', padding: '12px 20px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}