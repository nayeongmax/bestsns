import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 600 }}>
          <h2 style={{ color: '#b91c1c' }}>오류가 발생했습니다</h2>
          <pre style={{ background: '#fef2f2', padding: 12, overflow: 'auto' }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 12, padding: '8px 16px' }}
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// bestsns.com일 때는 상위에 이미 Router가 있다고 보고 우리는 Router를 넣지 않음 (중첩 오류 방지)
// 그 외(로컬, netlify.app 등)에서는 우리가 HashRouter 한 번만 사용
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isBestsns = host === 'bestsns.com' || host.endsWith('.bestsns.com');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isBestsns ? <App /> : <HashRouter><App /></HashRouter>}
    </ErrorBoundary>
  </React.StrictMode>
);
