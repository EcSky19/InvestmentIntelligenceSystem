// All API calls to the backend

const BASE = import.meta.env.VITE_API_URL || '/api';

function getAuthHeader() {
  const key = localStorage.getItem('sma_auth_key') || '';
  return key ? { 'Authorization': `Bearer ${key}` } : {};
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) throw Object.assign(new Error('Unauthorized — check your auth key'), { code: 'AUTH' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// Dashboard summary
export const getDashboard       = ()            => apiFetch('/dashboard');
export const getHealth          = ()            => apiFetch('/health');

// Scans
export const listScans          = (params = {}) => apiFetch(`/scans?${new URLSearchParams(params)}`);
export const getScan            = (id)          => apiFetch(`/scans/${id}`);
export const getLatestScan      = ()            => apiFetch('/scans/latest');

// Trigger scan with SSE progress streaming
export function triggerScan(opts = {}, onEvent) {
  const controller = new AbortController();

  const run = async () => {
    const res = await fetch(`${BASE}/scans/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(opts),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message', data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:'))  data  = line.slice(5).trim();
        }
        if (data) {
          try { onEvent(event, JSON.parse(data)); }
          catch {}
        }
      }
    }
  };

  run().catch(err => { if (err.name !== 'AbortError') onEvent('error', { message: err.message }); });
  return () => controller.abort();
}

export const runJob = (name) => apiFetch(`/scans/jobs/${name}`, { method: 'POST' });

// Alerts
export const listAlerts         = (params = {}) => apiFetch(`/alerts?${new URLSearchParams(params)}`);
export const getAlert           = (id)          => apiFetch(`/alerts/${id}`);
export const getActiveAlerts    = ()            => apiFetch('/alerts/active');
export const getAlertsByTicker  = (ticker, limit = 50) => apiFetch(`/alerts/ticker/${ticker}?limit=${limit}`);
export const updateAlertOutcome = (id, outcomeLabel) =>
  apiFetch(`/alerts/${id}/outcome`, { method: 'PATCH', body: JSON.stringify({ outcomeLabel }) });

// Follow-through
export const getPendingFollowthrough = () => apiFetch('/followthrough/pending');
export const getFollowthroughForAlert = (id) => apiFetch(`/followthrough/${id}`);

export function runFollowthroughBatch(onEvent) {
  const controller = new AbortController();
  const run = async () => {
    const res = await fetch(`${BASE}/followthrough/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message', data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:'))  data  = line.slice(5).trim();
        }
        if (data) try { onEvent(event, JSON.parse(data)); } catch {}
      }
    }
  };
  run().catch(err => { if (err.name !== 'AbortError') onEvent('error', { message: err.message }); });
  return () => controller.abort();
}

// Performance
export const getPerformanceStats = (params = {}) => apiFetch(`/performance/stats?${new URLSearchParams(params)}`);
export const getPerformanceWeights = ()          => apiFetch('/performance/weights');
export const runPerformanceRecalc  = ()          => apiFetch('/performance/recalc', { method: 'POST' });

// Regime
export const getRegimeHistory = (days = 90) => apiFetch(`/regime/history?days=${days}`);
export const getCurrentRegime = ()           => apiFetch('/regime/current');
