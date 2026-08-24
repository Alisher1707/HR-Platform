import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * ErrorBoundary
 *
 * React unmounts an entire subtree the instant a render throws — with
 * nothing here to catch that, the result was a blank white screen and no
 * way back except manually retyping the URL. This happened for real this
 * session (a variable referenced before its own declaration crashed the
 * whole Onboarding page). A render bug should never be worse for the user
 * than a normal failed request; this turns it into a real screen with an
 * explanation and a way out, instead of nothing at all.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Always logged — this is the one place a render-time bug can be
    // observed at all, since the error never reaches the network tab.
    console.error('UI xatosi (ErrorBoundary):', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--error-light, #fbeaec)',
            color: 'var(--error, #a71d2a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={28} strokeWidth={2} />
        </div>
        <div>
          <h2 style={{ margin: '0 0 0.375rem', fontSize: '1.25rem', fontWeight: 700 }}>
            Nimadir noto'g'ri ketdi
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 420 }}>
            Sahifada kutilmagan xatolik yuz berdi. Boshqa bo'limlar odatdagidek ishlayveradi —
            quyidagi tugma orqali sahifani qayta yuklang.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RotateCcw size={16} strokeWidth={2} />
          Sahifani qayta yuklash
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
