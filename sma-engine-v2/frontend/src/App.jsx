import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import DashboardPage    from './pages/Dashboard.jsx';
import ArchivePage      from './pages/Archive.jsx';
import AlertsPage       from './pages/Alerts.jsx';
import PerformancePage  from './pages/Performance.jsx';
import SettingsPage     from './pages/Settings.jsx';
import ToastContainer   from './components/ToastContainer.jsx';
import { getHealth, getCurrentRegime } from './api/client.js';

export default function App() {
  const [apiConnected, setApiConnected] = useState(null); // null=unknown, true, false
  const [regime,       setRegime]       = useState(null);
  const [lastScan,     setLastScan]     = useState(null);
  const [toasts,       setToasts]       = useState([]);
  const [showKeyForm,  setShowKeyForm]  = useState(false);
  const [authKeyInput, setAuthKeyInput] = useState('');
  const toastId = useRef(0);

  const showToast = useCallback((title, msg, type = 'info', ms = 4500) => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, title, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms);
  }, []);

  // Check API connection on mount
  useEffect(() => {
    getHealth()
      .then(h => {
        setApiConnected(true);
        setLastScan(h.stats?.last_scan_time);
      })
      .catch(() => setApiConnected(false));

    getCurrentRegime()
      .then(r => setRegime(r))
      .catch(() => {});
  }, []);

  function saveAuthKey() {
    const k = authKeyInput.trim();
    if (k) { localStorage.setItem('sma_auth_key', k); showToast('Auth Key Saved', '', 'success'); }
    setShowKeyForm(false);
  }
  function clearAuthKey() {
    localStorage.removeItem('sma_auth_key');
    setAuthKeyInput('');
    showToast('Auth Key Cleared', '', 'info');
  }

  const regimeCls = regime?.regime_label === 'Bullish' ? 'regime-bull'
    : regime?.regime_label === 'Bearish' ? 'regime-bear'
    : regime?.regime_label === 'Neutral' ? 'regime-neutral' : 'regime-unknown';

  const regimeLabel = regime?.regime_label
    ? `${regime.regime_label.toUpperCase()} · ${regime.pct_above_50dma != null ? Number(regime.pct_above_50dma).toFixed(0) + '% Above 50DMA' : '—'}`
    : 'UNKNOWN · No Data';

  const storedKey = localStorage.getItem('sma_auth_key') || '';

  // Share toast + setLastScan down via context (simple prop-threading for now)
  const sharedProps = { showToast, setLastScan, setRegime };

  return (
    <div className="page">
      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-top">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div className="logo-mark">↕50</div>
            <div>
              <div className="engine-title">50-DAY SMA CROSSING ENGINE v2</div>
              <div className="engine-sub">
                VPS · PostgreSQL · Automated Scans · Real Massive Data ·
                Last scan: {lastScan ? new Date(lastScan).toLocaleTimeString() : '—'}
              </div>
            </div>
          </div>
          <div className="header-right">
            <span className={`regime-badge ${regimeCls}`}>
              {regime?.regime_label === 'Bullish' && '▲ '}
              {regime?.regime_label === 'Bearish' && '▼ '}
              {regime?.regime_label === 'Neutral' && '→ '}
              {regimeLabel}
            </span>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:5,
              padding:'4px 10px', borderRadius:4, fontSize:10,
              fontWeight:600, letterSpacing:'.06em', border:'1px solid',
              background: apiConnected === true  ? 'rgba(34,197,94,.1)'  :
                          apiConnected === false ? 'rgba(244,63,94,.1)'  : 'rgba(71,85,105,.1)',
              borderColor: apiConnected === true  ? 'rgba(34,197,94,.3)'  :
                           apiConnected === false ? 'rgba(244,63,94,.3)'  : 'var(--border)',
              color: apiConnected === true  ? 'var(--green)'  :
                     apiConnected === false ? 'var(--red)'    : 'var(--text-muted)',
            }}>
              {apiConnected === true ? '● API CONNECTED' : apiConnected === false ? '● API OFFLINE' : '● CONNECTING…'}
            </span>
            <button className="btn btn-muted btn-sm" onClick={() => { setShowKeyForm(s => !s); setAuthKeyInput(storedKey); }}>
              {storedKey ? '✓ AUTH SET' : 'SET AUTH'}
            </button>
          </div>
        </div>

        {showKeyForm && (
          <div className="key-form">
            <span className="key-label">AUTH KEY:</span>
            <input className="key-input" type="password"
              placeholder="Bearer token — matches AUTH_KEY in backend .env"
              value={authKeyInput} onChange={e => setAuthKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveAuthKey()}
            />
            <button className="btn btn-success btn-sm" onClick={saveAuthKey}>SAVE</button>
            <button className="btn btn-danger btn-sm"  onClick={clearAuthKey}>CLEAR</button>
            <span style={{ fontSize:10, color: storedKey ? 'var(--green)' : 'var(--text-muted)' }}>
              {storedKey ? '✓ Key stored' : 'No key set'}
            </span>
          </div>
        )}

        {/* ── NAV TABS ── */}
        <nav className="nav-tabs">
          {[
            { to: '/',           label: 'SCAN DASHBOARD' },
            { to: '/archive',    label: 'ARCHIVE' },
            { to: '/alerts',     label: 'ALERTS' },
            { to: '/performance',label: 'PERFORMANCE' },
            { to: '/settings',   label: 'SETTINGS' },
          ].map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}
              className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="main">
        <Routes>
          <Route path="/"            element={<DashboardPage    {...sharedProps} />} />
          <Route path="/archive"     element={<ArchivePage      {...sharedProps} />} />
          <Route path="/alerts"      element={<AlertsPage       {...sharedProps} />} />
          <Route path="/performance" element={<PerformancePage  {...sharedProps} />} />
          <Route path="/settings"    element={<SettingsPage     {...sharedProps} />} />
        </Routes>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
