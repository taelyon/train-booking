import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 프론트엔드 글로벌 에러 로깅 (빈 화면 버그 등 추적)
window.addEventListener('error', (event) => {
  try {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? event.error.stack : ''
      })
    });
  } catch (e) {
    console.error('Error logging failed', e);
  }
});

// Promise Unhandled Rejection 로깅
window.addEventListener('unhandledrejection', (event) => {
  try {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Unhandled Promise Rejection',
        source: 'Promise',
        lineno: 0,
        colno: 0,
        error: event.reason ? (event.reason.stack || String(event.reason)) : ''
      })
    });
  } catch (e) {
    console.error('Error logging failed', e);
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

