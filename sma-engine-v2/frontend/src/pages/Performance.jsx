import React, { useState, useEffect } from 'react';
import { getPerformanceStats, getPerformanceWeights, runPerformanceRecalc,
  getRegimeHistory } from '../api/client.js';
import { EmptyState, Spinner, fmt, fmtPct } from '../components/ToastContainer.jsx';

function ConfirmBar({ rate, n = 100 }) {
  if (rate == null) return <span style={{ color:'var(--text-muted)' }}>—</span>;
  const pct = Math.min(100, Math.max(0, Number(rate)));
  const col = pct >= 65 ? 'var(--green)' : pct >= 45 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontWeight:700, color:col, width:34, textAlign:'right' }}>{pct.toFixed(0)}%</span>
      <div style={{ width:50, height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:col, borderRadius:3 }}/>
      </div>
    </div>
  );
}

function WeightBar({ factor, weight, prevWeight }) {
  const pct  = Math.round(weight * 100);
  const prev = prevWeight ? Math.round(prevWeight * 100) : null;
  const diff = prev != null ? pct - prev : 0;
  const LABELS = {
    crossing_quality: 'Crossing Quality',
    rel_vol:          'Relative Volume',
    close_location:   'Close Location',
    distance:         'Distance from 50D',
    prior_context:    'Prior Context',
  };
  return (
    <div style={{ background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:5, padding:'10px 14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em', color:'var(--text-dim)' }}>
          {LABELS[factor] || factor}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {diff !== 0 && (
            <span style={{ fontSize:9, fontWeight:700, color:diff>0?'var(--green)':'var(--red)' }}>
              {diff>0?'↑':'↓'}{Math.abs(diff)}pp
            </span>
          )}
          <span style={{ fontSize:14, fontWeight:700, color:'var(--blue)' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ width:'100%', height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:'var(--blue)', borderRadius:3, transition:'width .5s' }}/>
      </div>
      {prev != null && (
        <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:4 }}>
          Previous: {prev}% → {pct}%
        </div>
      )}
    </div>
  );
}

function RegimeChart({ history }) {
  if (!history?.length) return <div style={{ color:'var(--text-muted)', fontSize:11, padding:'12px 0' }}>No regime history yet.</div>;
  const recent = [...history].slice(0, 60).reverse();
  const maxAbove = Math.max(...recent.map(r => r.above_crosses||0), 1);
  const maxBelow = Math.max(...recent.map(r => r.below_crosses||0), 1);

  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:80, minWidth:recent.length*14, paddingBottom:4 }}>
        {recent.map((r, i) => {
          const aH = Math.round((r.above_crosses||0)/maxAbove*72);
          const bH = Math.round((r.below_crosses||0)/maxBelow*72);
          const rc = r.regime_label==='Bullish'?'var(--green)':r.regime_label==='Bearish'?'var(--red)':'var(--purple)';
          return (
            <div key={i} style={{ display:'flex', alignItems:'flex-end', gap:1, flexShrink:0 }}
              title={`${r.log_date}: ${r.regime_label} · ${r.above_crosses}↑ ${r.below_crosses}↓ · ${fmt(r.pct_above_50dma,0)}% above`}>
              <div style={{ width:5, background:'var(--green)', opacity:.8, height:`${aH}px`, borderRadius:'2px 2px 0 0' }}/>
              <div style={{ width:5, background:'var(--red)',   opacity:.8, height:`${bH}px`, borderRadius:'2px 2px 0 0' }}/>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:16, marginTop:8, fontSize:10, color:'var(--text-muted)' }}>
        <span><span style={{ color:'var(--green)' }}>■</span> Above Crosses</span>
        <span><span style={{ color:'var(--red)' }}>■</span> Below Crosses</span>
        <span style={{ marginLeft:'auto', fontSize:9 }}>Hover bars for detail · {recent.length} trading days shown</span>
      </div>
    </div>
  );
}

export default function PerformancePage({ showToast }) {
  const [stats,   setStats]   = useState([]);
  const [weights, setWeights] = useState(null);
  const [regime,  setRegime]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalcRunning, setRecalcRunning] = useState(false);

  const [fStatus,  setFStatus]  = useState('Any');
  const [fSector,  setFSector]  = useState('Any');
  const [fRvol,    setFRvol]    = useState('Any');
  const [sortKey,  setSortKey]  = useState('confirm_rate_5d');
  const [sortDir,  setSortDir]  = useState('desc');

  useEffect(() => {
    Promise.all([
      getPerformanceStats({ minSignals:3 }).catch(()=>({ stats:[] })),
      getPerformanceWeights().catch(()=>null),
      getRegimeHistory(90).catch(()=>({ history:[] })),
    ]).then(([ps, wts, rh]) => {
      setStats(ps.stats||[]);
      setWeights(wts);
      setRegime(rh.history||[]);
      setLoading(false);
    });
  }, []);

  async function triggerRecalc() {
    setRecalcRunning(true);
    try {
      await runPerformanceRecalc();
      const [ps, wts] = await Promise.all([
        getPerformanceStats({ minSignals:3 }),
        getPerformanceWeights(),
      ]);
      setStats(ps.stats||[]);
      setWeights(wts);
      showToast('Recalculated', 'Performance stats updated', 'success');
    } catch (err) {
      showToast('Recalc Failed', err.message, 'error');
    }
    setRecalcRunning(false);
  }

  function handleSort(k) {
    if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }

  const allStatuses = [...new Set(stats.map(s=>s.status_type))].sort();
  const allSectors  = [...new Set(stats.map(s=>s.sector).filter(Boolean))].sort();
  const allRvols    = [...new Set(stats.map(s=>s.rvol_bucket).filter(Boolean))];

  let filtered = [...stats];
  if (fStatus !== 'Any') filtered = filtered.filter(s=>s.status_type===fStatus);
  if (fSector !== 'Any') filtered = filtered.filter(s=>s.sector===fSector);
  if (fRvol   !== 'Any') filtered = filtered.filter(s=>s.rvol_bucket===fRvol);
  filtered.sort((a,b) => {
    const d = sortDir==='asc'?1:-1;
    const va=a[sortKey], vb=b[sortKey];
    if (va==null) return 1; if (vb==null) return -1;
    return (va-vb)*d;
  });

  const wArr = weights?.dbWeights || weights?.activeWeights
    ? Object.entries(weights?.activeWeights||{}).map(([factor,weight])=>({factor,weight}))
    : [];
  const dbWArr = weights?.dbWeights || [];
  const dataPoints = dbWArr[0]?.data_points || 0;
  const calibrated = dataPoints >= 200;

  const th = (l, sk) => (
    <th onClick={()=>handleSort(sk)} style={{ cursor:'pointer', userSelect:'none', color:sortKey===sk?'var(--blue)':'var(--text-muted)', fontSize:9, fontWeight:600, padding:'6px 8px', letterSpacing:'.08em', background:'var(--bg-card)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
      {l}{sortKey===sk ? (sortDir==='asc'?' ▲':' ▼') : ' ⇅'}
    </th>
  );

  return (
    <div style={{ padding:'0 0 60px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14, letterSpacing:'.06em' }}>PATTERN PERFORMANCE</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
            Confirm rates and returns by signal type · Populated as follow-through data accumulates
          </div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginLeft:'auto' }}
          onClick={triggerRecalc} disabled={recalcRunning}>
          {recalcRunning ? '⟳ RUNNING…' : '⟳ RECALCULATE NOW'}
        </button>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
      ) : (
        <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Score Weight Calibration */}
          <div className="card">
            <div className="section-title">
              SCORE WEIGHT CALIBRATION
              <span style={{ marginLeft:10, fontSize:9, fontWeight:700,
                color:calibrated?'var(--green)':'var(--amber)',
                background:calibrated?'rgba(34,197,94,.1)':'rgba(245,158,11,.1)',
                border:`1px solid ${calibrated?'rgba(34,197,94,.3)':'rgba(245,158,11,.3)'}`,
                borderRadius:3, padding:'1px 6px' }}>
                {calibrated ? `✓ CALIBRATED (n=${dataPoints})` : `INITIAL / NOT YET CALIBRATED (need 200+ follow-throughs, have ${dataPoints})`}
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
              {wArr.map(({ factor, weight }) => {
                const prev = dbWArr.find(w=>w.factor===factor)?.prev_weight;
                return <WeightBar key={factor} factor={factor} weight={weight} prevWeight={prev}/>;
              })}
            </div>
            {!calibrated && (
              <div style={{ marginTop:10, fontSize:10, color:'var(--text-muted)', lineHeight:1.8 }}>
                Weights auto-calibrate to outcome correlations after 200+ 5-day follow-through observations.
                Currently using initial defaults. Keep running daily scans — calibration activates automatically.
              </div>
            )}
          </div>

          {/* Regime History Chart */}
          <div className="card">
            <div className="section-title">REGIME HISTORY (Last 60 Trading Days)</div>
            <RegimeChart history={regime}/>
          </div>

          {/* Regime Log Table */}
          {regime.length > 0 && (
            <div className="card">
              <div className="section-title">DAILY REGIME LOG</div>
              <div style={{ overflowX:'auto', maxHeight:300, overflowY:'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ fontSize:9, color:'var(--text-muted)', padding:'6px 8px', letterSpacing:'.08em', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>DATE</th>
                      <th style={{ fontSize:9, color:'var(--text-muted)', padding:'6px 8px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>REGIME</th>
                      <th style={{ fontSize:9, color:'var(--text-muted)', padding:'6px 8px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>% ABOVE</th>
                      <th style={{ fontSize:9, color:'var(--green)', padding:'6px 8px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>↑ CROSSES</th>
                      <th style={{ fontSize:9, color:'var(--red)', padding:'6px 8px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>↓ CROSSES</th>
                      <th style={{ fontSize:9, color:'var(--text-muted)', padding:'6px 8px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>EXT RVOL</th>
                      <th style={{ fontSize:9, color:'var(--text-muted)', padding:'6px 8px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>CHANGED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regime.slice(0,30).map(r => (
                      <tr key={r.id||r.log_date} style={{ background:'var(--bg-row)', borderBottom:'1px solid var(--border)' }}>
                        <td style={{ fontSize:10, color:'var(--text-muted)' }}>{r.log_date}</td>
                        <td style={{ fontWeight:700, color:r.regime_label==='Bullish'?'var(--green)':r.regime_label==='Bearish'?'var(--red)':'var(--purple)' }}>{r.regime_label||'—'}</td>
                        <td>{r.pct_above_50dma!=null?fmt(r.pct_above_50dma,0)+'%':'—'}</td>
                        <td style={{ color:'var(--green)', fontWeight:600 }}>{r.above_crosses||0}</td>
                        <td style={{ color:'var(--red)',   fontWeight:600 }}>{r.below_crosses||0}</td>
                        <td style={{ color:'var(--blue)' }}>{r.extreme_rvol||0}</td>
                        <td style={{ fontSize:9, color:r.regime_changed?'var(--amber)':'var(--text-muted)' }}>
                          {r.regime_changed ? '⚡ YES' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pattern Performance Table */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
              <div className="section-title" style={{ margin:0 }}>PATTERN CONFIRM RATES</div>
              <select className={`ctrl-select btn-sm${fStatus!=='Any'?' active':''}`} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                <option value="Any">All Statuses</option>
                {allStatuses.map(s=><option key={s}>{s}</option>)}
              </select>
              <select className={`ctrl-select btn-sm${fSector!=='Any'?' active':''}`} value={fSector} onChange={e=>setFSector(e.target.value)}>
                <option value="Any">All Sectors</option>
                {allSectors.map(s=><option key={s}>{s}</option>)}
              </select>
              <select className={`ctrl-select btn-sm${fRvol!=='Any'?' active':''}`} value={fRvol} onChange={e=>setFRvol(e.target.value)}>
                <option value="Any">All RVol Buckets</option>
                {allRvols.map(s=><option key={s}>{s}</option>)}
              </select>
              <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>{filtered.length} patterns</span>
            </div>

            {stats.length === 0 ? (
              <EmptyState icon="📊" title="No Performance Data Yet"
                sub="Performance stats populate as follow-through observations accumulate (1/3/5/10/20-day re-pricing). Run daily scans and check back in ~2 weeks for meaningful data."/>
            ) : filtered.length === 0 ? (
              <div style={{ color:'var(--text-muted)', fontSize:11, padding:'12px 0' }}>No patterns match filters.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {th('STATUS','status_type')}{th('SECTOR','sector')}{th('RVOL BUCKET','rvol_bucket')}{th('SCORE','score_bracket')}
                      {th('SIGNALS','total_signals')}
                      {th('CR 1D','confirm_rate_1d')}{th('CR 3D','confirm_rate_3d')}{th('CR 5D','confirm_rate_5d')}
                      {th('CR 10D','confirm_rate_10d')}{th('CR 20D','confirm_rate_20d')}
                      {th('AVG 5D','avg_return_5d')}{th('AVG 10D','avg_return_10d')}
                      {th('AVG RVOL','avg_rvol_at_signal')}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0,100).map((s,i) => (
                      <tr key={i} style={{ background:'var(--bg-row)', borderBottom:'1px solid var(--border)' }}>
                        <td style={{ fontWeight:700, fontSize:11 }}>{s.status_type}</td>
                        <td style={{ color:'var(--text-dim)', fontSize:10 }}>{s.sector||'—'}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:10 }}>{s.rvol_bucket||'—'}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:10 }}>{s.score_bracket!=null?`${s.score_bracket}+`:'—'}</td>
                        <td style={{ fontWeight:600, color:'var(--blue)' }}>{s.total_signals}</td>
                        <td><ConfirmBar rate={s.confirm_rate_1d}/></td>
                        <td><ConfirmBar rate={s.confirm_rate_3d}/></td>
                        <td><ConfirmBar rate={s.confirm_rate_5d}/></td>
                        <td><ConfirmBar rate={s.confirm_rate_10d}/></td>
                        <td><ConfirmBar rate={s.confirm_rate_20d}/></td>
                        <td className={s.avg_return_5d>=0?'pos':'neg'}>{fmtPct(s.avg_return_5d)}</td>
                        <td className={s.avg_return_10d>=0?'pos':'neg'}>{fmtPct(s.avg_return_10d)}</td>
                        <td style={{ color:(s.avg_rvol_at_signal||0)>1.5?'var(--green)':'var(--text-dim)' }}>
                          {s.avg_rvol_at_signal!=null?fmt(s.avg_rvol_at_signal,2)+'x':'—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
