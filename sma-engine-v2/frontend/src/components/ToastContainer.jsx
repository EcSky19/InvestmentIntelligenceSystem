import React from 'react';

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
export const fmt      = (v, d=2)  => v==null||isNaN(v) ? '—' : Number(v).toFixed(d);
export const fmtPct   = v         => v==null ? '—' : (v>=0?'+':'') + Number(v).toFixed(2)+'%';
export const fmtPrice = v         => v==null ? '—' : '$'+Number(v).toFixed(2);
export const fmtRvol  = v         => v==null ? '—' : Number(v).toFixed(2)+'x';
export const fmtVol   = v         => !v ? '—' : v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':String(Math.round(v));

export const STATUS_CODES = {
  CA:'Crossing Above 50-Day SMA', CB:'Crossing Below 50-Day SMA',
  FA:'First Close Above 50-Day SMA', FB:'First Close Below 50-Day SMA',
  TB:'Testing From Below', TA:'Testing From Above',
  HA:'Holding Above 50-Day SMA', HB:'Holding Below 50-Day SMA',
  RJ:'Rejected At 50-Day SMA', RC:'Reclaimed 50-Day SMA',
  LS:'Lost 50-Day SMA', NA:'No Signal',
};
export const STATUS_CLS = {
  CA:'s-bull', CB:'s-bear', FA:'s-bull', FB:'s-bear',
  RC:'s-bull', LS:'s-bear', RJ:'s-reject',
  TB:'s-test-b', TA:'s-test-a',
  HA:'s-hold-a', HB:'s-hold-b', NA:'s-na',
};

export function scoreColor(s) {
  if (s>=80) return 'var(--green)';
  if (s>=60) return 'var(--blue)';
  if (s>=40) return 'var(--amber)';
  return 'var(--text-muted)';
}
export function rvolClass(rv) {
  if (!rv) return 'rv-very-low';
  if (rv>=5)    return 'rv-extreme';
  if (rv>=3)    return 'rv-very-high';
  if (rv>=2)    return 'rv-high';
  if (rv>=1.5)  return 'rv-elevated';
  if (rv>=0.75) return 'rv-normal';
  if (rv>=0.25) return 'rv-low';
  return 'rv-very-low';
}
export function dirClass(dir) {
  return dir==='Bullish'?'dir-bull':dir==='Bearish'?'dir-bear':'dir-neut';
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

export function ScoreBar({ score }) {
  const c = scoreColor(score);
  return (
    <div className="score-bar">
      <span className="score-val" style={{color:c}}>{score}</span>
      <div className="score-track">
        <div className="score-fill" style={{width:`${score}%`,background:c}}/>
      </div>
    </div>
  );
}

export function StatusBadge({ code }) {
  return (
    <span className={`status-badge ${STATUS_CLS[code]||'s-na'}`}>
      {STATUS_CODES[code] || code || '—'}
    </span>
  );
}

export function DirTag({ dir }) {
  return <span className={`dir-tag ${dirClass(dir)}`}>{dir||'—'}</span>;
}

export function RvolCell({ rv }) {
  if (rv==null) return <span className="rv-very-low">—</span>;
  return (
    <span className={rvolClass(rv)}>
      {fmtRvol(rv)}
      {rv>=10 && <span style={{marginLeft:4,fontSize:8,background:'rgba(34,197,94,.15)',padding:'1px 4px',borderRadius:3,border:'1px solid rgba(34,197,94,.3)',color:'var(--green)'}}>EXT</span>}
    </span>
  );
}

export function KpiCard({ label, value, sub, color, onClick, active, prog, total }) {
  const pct = prog && total ? Math.min(100, Math.round(prog/total*100)) : null;
  return (
    <div className={`kpi-card ${color||''} ${active?'active':''}`} onClick={onClick} style={{cursor:onClick?'pointer':'default'}}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value??'—'}</div>
      <div className="kpi-sub">{sub}</div>
      {pct!=null && <div className="kpi-prog"><div className="kpi-prog-fill" style={{width:`${pct}%`}}/></div>}
    </div>
  );
}

export function SortTh({ label, sk, sortKey, sortDir, onSort }) {
  const active = sortKey === sk;
  return (
    <th onClick={() => onSort(sk)} className={active?'sort-active':''}>
      {label}
      <span style={{fontSize:8,marginLeft:4,opacity:active?1:.4}}>
        {active ? (sortDir==='asc'?'▲':'▼') : '⇅'}
      </span>
    </th>
  );
}

export function OutcomeBadge({ label }) {
  const c = label==='Confirmed'?'var(--green)':label==='Failed'?'var(--red)':label==='Reversed'?'var(--orange)':label==='Still Active'?'var(--blue)':'var(--text-muted)';
  return <span style={{fontSize:9,fontWeight:700,color:c}}>{label||'—'}</span>;
}

export function EmptyState({ icon='↕', title='No Data', sub='' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  );
}

export function Spinner({ size=20 }) {
  return <div className="scan-spinner" style={{width:size,height:size,borderWidth:2}}/>;
}

export default function ToastContainer({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <div className="toast-title">{t.title}</div>
          {t.msg && <div className="toast-msg">{t.msg}</div>}
        </div>
      ))}
    </div>
  );
}
