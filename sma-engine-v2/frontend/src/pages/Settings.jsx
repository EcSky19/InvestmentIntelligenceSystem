import React, { useState, useEffect } from 'react';
import { getHealth, runJob, runPerformanceRecalc } from '../api/client.js';
import { Spinner, fmt } from '../components/ToastContainer.jsx';

const NAMED_JOBS = [
  { name:'morning_brief',    label:'Morning Brief (T1)', schedule:'8:30 AM Mon–Fri' },
  { name:'open_scan',        label:'Open Scan (T1)',     schedule:'9:35 AM Mon–Fri' },
  { name:'midmorning_scan',  label:'Mid-Morning (T1)',   schedule:'11:00 AM Mon–Fri' },
  { name:'afternoon_scan',   label:'Afternoon (T1)',     schedule:'1:30 PM Mon–Fri' },
  { name:'preclose_scan',    label:'Pre-Close (T1)',     schedule:'3:30 PM Mon–Fri' },
  { name:'eod_scan',         label:'EOD + Follow-Through (T2)', schedule:'4:15 PM Mon–Fri' },
  { name:'performance_recalc',label:'Nightly Performance Recalc', schedule:'11:00 PM Mon–Fri' },
  { name:'weekly_deep_scan', label:'Weekly Deep Scan (T3)', schedule:'Sat 8:00 AM' },
  { name:'weekly_digest',    label:'Weekly Email Digest',   schedule:'Sat 10:00 AM' },
  { name:'db_backup',        label:'Database Backup',        schedule:'2:00 AM Daily' },
];

function StatRow({ label, value, valueColor }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight:700, color:valueColor||'var(--text)' }}>{value}</span>
    </div>
  );
}

export default function SettingsPage({ showToast }) {
  const [health,  setHealth]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState({});

  function loadHealth() {
    setLoading(true);
    getHealth()
      .then(h => { setHealth(h); setLoading(false); })
      .catch(err => { showToast('Health Check Failed', err.message, 'error'); setLoading(false); });
  }
  useEffect(() => { loadHealth(); }, []);

  async function triggerJob(name) {
    setRunning(r => ({ ...r, [name]: true }));
    try {
      await runJob(name);
      showToast('Job Triggered', `${name} started on server`, 'success');
    } catch (err) {
      showToast('Job Failed', err.message, 'error');
    }
    setTimeout(() => setRunning(r => ({ ...r, [name]: false })), 3000);
  }

  const dbStats = health?.stats;
  const cfg     = health?.config;
  const jobs    = health?.scheduler || [];
  const weights = health?.scoreWeights || [];

  return (
    <div style={{ padding:'16px', paddingBottom:60, maxWidth:960, margin:'0 auto', display:'flex', flexDirection:'column', gap:20 }}>

      {/* Status Bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ fontWeight:700, fontSize:14, letterSpacing:'.06em' }}>SETTINGS & SYSTEM STATUS</div>
        <button className="btn btn-muted btn-sm" onClick={loadHealth} style={{ marginLeft:'auto' }}>⟳ REFRESH</button>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
      ) : !health ? (
        <div style={{ color:'var(--red)', fontSize:12 }}>
          Cannot connect to backend API. Check that the server is running and your AUTH_KEY is set.
        </div>
      ) : (
        <>
          {/* API Connection */}
          <div className="card">
            <div className="section-title">API CONNECTION</div>
            <StatRow label="Status"            value="✓ CONNECTED" valueColor="var(--green)"/>
            <StatRow label="Database"          value={health.db?.db || '—'} valueColor="var(--green)"/>
            <StatRow label="DB Server Time"    value={health.db?.now ? new Date(health.db.now).toLocaleTimeString() : '—'}/>
            <StatRow label="Scheduler Enabled" value={cfg?.schedulerEnabled?'✓ ENABLED':'✗ DISABLED'} valueColor={cfg?.schedulerEnabled?'var(--green)':'var(--amber)'}/>
            <StatRow label="Email Configured"  value={cfg?.emailConfigured?'✓ RESEND KEY SET':'✗ NOT CONFIGURED'} valueColor={cfg?.emailConfigured?'var(--green)':'var(--amber)'}/>
            <StatRow label="Default Tier"      value={cfg?.tier || '—'}/>
            <StatRow label="Batch Size"        value={cfg?.batchSize || '—'}/>
          </div>

          {/* Database Stats */}
          <div className="card">
            <div className="section-title">DATABASE STATS</div>
            <div className="card-grid-3">
              {[
                { l:'Total Scans',        v:dbStats?.total_scans,        c:'var(--blue)'   },
                { l:'Total Alerts',       v:dbStats?.total_alerts,       c:'var(--text)'   },
                { l:'Active Alerts',      v:dbStats?.active_alerts,      c:'var(--green)'  },
                { l:'Bullish Events',     v:dbStats?.total_above,        c:'var(--green)'  },
                { l:'Bearish Events',     v:dbStats?.total_below,        c:'var(--red)'    },
                { l:'Follow-Throughs',    v:dbStats?.total_followthroughs,c:'var(--purple)'},
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:5, padding:'10px 14px' }}>
                  <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:600, letterSpacing:'.1em', marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:22, fontWeight:700, color:c }}>{v ?? '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12, fontSize:10, color:'var(--text-muted)' }}>
              Last scan: <strong style={{ color:'var(--text-dim)' }}>
                {dbStats?.last_scan_time ? new Date(dbStats.last_scan_time).toLocaleString() : 'Never'}
              </strong>
            </div>
          </div>

          {/* Score Weights */}
          <div className="card">
            <div className="section-title">ACTIVE SCORE WEIGHTS</div>
            {weights.length === 0 ? (
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>No weights loaded.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {['FACTOR','WEIGHT','PREV WEIGHT','DATA POINTS','NOTES','DATE'].map(h => (
                        <th key={h} style={{ fontSize:9, color:'var(--text-muted)', fontWeight:600, padding:'6px 8px', letterSpacing:'.08em', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weights.map(w => (
                      <tr key={w.id||w.factor} style={{ background:'var(--bg-row)', borderBottom:'1px solid var(--border)' }}>
                        <td style={{ fontWeight:600, fontSize:11 }}>{w.factor}</td>
                        <td style={{ fontWeight:700, color:'var(--blue)' }}>{(parseFloat(w.weight)*100).toFixed(1)}%</td>
                        <td style={{ color:'var(--text-muted)' }}>{w.prev_weight!=null?(parseFloat(w.prev_weight)*100).toFixed(1)+'%':'—'}</td>
                        <td style={{ color:'var(--text-dim)' }}>{w.data_points ?? '—'}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:10, fontStyle:'italic' }}>{w.notes || '—'}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:10 }}>{w.computed_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scheduler Jobs */}
          <div className="card">
            <div className="section-title">SCHEDULED JOBS</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
              {NAMED_JOBS.map(job => {
                const serverJob = jobs.find(j => j.name === job.name);
                const isActive  = serverJob?.active;
                return (
                  <div key={job.name} style={{ background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:5, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:11, color:'var(--text-dim)' }}>{job.label}</div>
                      <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2 }}>
                        {job.schedule}
                        {isActive && <span style={{ marginLeft:8, color:'var(--green)', fontWeight:700 }}>⟳ RUNNING</span>}
                      </div>
                    </div>
                    <button
                      className="btn btn-muted btn-sm"
                      style={{ flexShrink:0, fontSize:9 }}
                      onClick={() => triggerJob(job.name)}
                      disabled={running[job.name]}
                    >
                      {running[job.name] ? '⟳' : '▶ RUN'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:12, fontSize:10, color:'var(--text-muted)', lineHeight:1.8 }}>
              All jobs run server-side in America/New_York timezone. Manual triggers run the full job immediately.
              EOD scan also runs follow-through batch and sends daily email digest.
            </div>
          </div>

          {/* Auth Key */}
          <div className="card">
            <div className="section-title">AUTH KEY (CLIENT-SIDE)</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.8 }}>
              Your auth key is stored in localStorage under <code style={{ color:'var(--blue)', background:'var(--bg-hover)', padding:'1px 5px', borderRadius:3 }}>sma_auth_key</code>.
              Set it using the <strong style={{ color:'var(--text-dim)' }}>SET AUTH</strong> button in the top header.
              This must match the <code style={{ color:'var(--blue)' }}>AUTH_KEY</code> value in your backend <code style={{ color:'var(--blue)' }}>.env</code> file.
            </div>
            <div style={{ marginTop:10, fontSize:10, color:localStorage.getItem('sma_auth_key')?'var(--green)':'var(--amber)' }}>
              {localStorage.getItem('sma_auth_key') ? '✓ Key is set in this browser' : '⚠ No key set — API requests will fail if backend requires auth'}
            </div>
          </div>

          {/* Backend Setup Reminder */}
          <div className="card">
            <div className="section-title">DEPLOYMENT CHECKLIST</div>
            {[
              { l:'Backend .env configured',          done:!!cfg },
              { l:'DATABASE_URL set + schema run',    done:!!health.db },
              { l:'POLYGON_API_KEY set',              done:!!cfg },
              { l:'AUTH_KEY set',                     done:!!cfg },
              { l:'RESEND_API_KEY set (optional)',     done:!!cfg?.emailConfigured },
              { l:'SCHEDULER_ENABLED=true',           done:!!cfg?.schedulerEnabled },
              { l:'PM2 process manager running',      done:health.status==='ok' },
              { l:'nginx reverse proxy configured',   done:health.status==='ok' },
              { l:'SSL certificate (Let\'s Encrypt)', done:false },
            ].map(({ l, done }) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:14, color:done?'var(--green)':'var(--text-muted)' }}>{done?'✓':'○'}</span>
                <span style={{ fontSize:11, color:done?'var(--text)':'var(--text-muted)' }}>{l}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
