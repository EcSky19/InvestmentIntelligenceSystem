import React, { useState, useEffect, useCallback } from 'react';
import { listAlerts, getAlert, updateAlertOutcome, getActiveAlerts,
  getFollowthroughForAlert } from '../api/client.js';
import { ScoreBar, StatusBadge, DirTag, RvolCell, OutcomeBadge, SortTh,
  EmptyState, Spinner, fmt, fmtPct, fmtPrice, fmtVol, fmtRvol
} from '../components/ToastContainer.jsx';

const OUTCOME_OPTIONS = [
  'Still Active','Confirmed','Failed','Reversed','Inconclusive','Low-Volume Noise','Data Issue','Expired'
];
const DIR_OPTS     = ['Any Direction','Bullish Only','Bearish Only'];
const OUTCOME_OPTS = ['Any Outcome','Still Active','Confirmed','Failed','Reversed','Inconclusive'];
const STATUS_OPTS  = ['Any Status','CA','FA','RC','CB','FB','LS','RJ','TB','TA','HA','HB'];

function FtRow({ ft }) {
  const heldColor = ft.held_new_side ? 'var(--green)' : ft.held_new_side===false ? 'var(--red)' : 'var(--text-muted)';
  return (
    <tr style={{ background:'var(--bg-row)', borderBottom:'1px solid var(--border)' }}>
      <td style={{ fontWeight:700 }}>{ft.days_since}D</td>
      <td style={{ color:'var(--text-muted)', fontSize:10 }}>{ft.check_date}</td>
      <td style={{ fontWeight:600 }}>{fmtPrice(ft.price)}</td>
      <td className={ft.return_pct>=0?'pos':'neg'}>{fmtPct(ft.return_pct)}</td>
      <td><RvolCell rv={ft.rel_vol_20}/></td>
      <td style={{ fontWeight:700, color:heldColor }}>
        {ft.held_new_side===true?'✓ YES':ft.held_new_side===false?'✗ NO':'—'}
      </td>
      <td><OutcomeBadge label={ft.outcome_label}/></td>
    </tr>
  );
}

function AlertModal({ alertId, onClose, showToast }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newOutcome, setNewOutcome] = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    getAlert(alertId)
      .then(d => {
        setData(d);
        setNewOutcome(d.alert?.outcome_label || 'Still Active');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [alertId]);

  async function saveOutcome() {
    if (!newOutcome) return;
    setSaving(true);
    try {
      await updateAlertOutcome(alertId, newOutcome);
      setData(d => ({ ...d, alert: { ...d.alert, outcome_label: newOutcome } }));
      setEditing(false);
      showToast('Outcome Updated', newOutcome, 'success');
    } catch (err) {
      showToast('Update Failed', err.message, 'error');
    }
    setSaving(false);
  }

  const a  = data?.alert;
  const ft = data?.followthrough || [];

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        {loading ? (
          <div style={{ padding:60, display:'flex', justifyContent:'center' }}><Spinner size={32}/></div>
        ) : !a ? (
          <div style={{ padding:20, color:'var(--red)' }}>Alert not found.</div>
        ) : (
          <>
            <div className="modal-header">
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span className="modal-ticker"
                    style={{ color:a.direction==='Bullish'?'var(--green)':a.direction==='Bearish'?'var(--red)':'var(--text)' }}>
                    {a.ticker}
                  </span>
                  <StatusBadge code={a.status}/>
                  <DirTag dir={a.direction}/>
                </div>
                <div className="modal-company">{a.company} · {a.exchange} · {a.sector} · {a.industry}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>
                  Alert Date: {a.alert_date} · Scan: {a.scan_time ? new Date(a.scan_time).toLocaleString() : '—'}
                </div>
              </div>
              <button onClick={onClose} className="btn btn-muted btn-sm">✕ CLOSE</button>
            </div>

            <div className="modal-body">
              {/* Score + KPIs */}
              <div>
                <div className="section-title">SIGNAL METRICS</div>
                <div className="card-grid-4">
                  {[
                    { l:'Signal Score', v:<ScoreBar score={a.signal_score??0}/> },
                    { l:'Price', v:fmtPrice(a.price), c:'var(--text)' },
                    { l:'50-Day SMA', v:fmtPrice(a.sma50), c:'var(--text-dim)' },
                    { l:'Distance %', v:fmtPct(a.dist_pct), c:a.dist_pct>=0?'var(--green)':'var(--red)' },
                    { l:'Rel Vol (20D)', v:fmtRvol(a.rel_vol_20), c:(a.rel_vol_20||0)>1.5?'var(--green)':'var(--text)' },
                    { l:'Volume', v:fmtVol(a.volume) },
                    { l:'Close Location', v:a.close_location!=null?fmt(a.close_location*100)+'%':'—' },
                    { l:'Days Prior Side', v:a.days_on_prev_side??'—' },
                    { l:'5D Return', v:fmtPct(a.ret_5d), c:a.ret_5d>=0?'var(--green)':'var(--red)' },
                    { l:'10D Return', v:fmtPct(a.ret_10d), c:a.ret_10d>=0?'var(--green)':'var(--red)' },
                    { l:'Regime', v:a.regime_at_alert||'—', c:a.regime_at_alert==='Bullish'?'var(--green)':a.regime_at_alert==='Bearish'?'var(--red)':'var(--purple)' },
                    { l:'% Above at Alert', v:a.pct_above_at_alert!=null?fmt(a.pct_above_at_alert,0)+'%':'—' },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="card" style={{ padding:'8px 12px' }}>
                      <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:600, letterSpacing:'.1em', marginBottom:4 }}>{l}</div>
                      <div style={{ fontWeight:700, color:c||'var(--text)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-scores */}
              <div>
                <div className="section-title">SCORE BREAKDOWN</div>
                <div className="card-grid-4">
                  {[
                    { l:'Crossing Quality', v:a.score_crossing_quality, w:'45%' },
                    { l:'Relative Volume',  v:a.score_rel_vol,          w:'35%' },
                    { l:'Close Location',   v:a.score_close_loc,        w:'10%' },
                    { l:'Distance',         v:a.score_distance,         w:'5%'  },
                    { l:'Prior Context',    v:a.score_prior_context,    w:'5%'  },
                  ].map(({ l, v, w }) => v != null && (
                    <div key={l} className="card" style={{ padding:'8px 12px' }}>
                      <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:600, letterSpacing:'.1em', marginBottom:4 }}>{l}</div>
                      <ScoreBar score={v}/>
                      <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2 }}>Weight: {w}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              {a.explanation && (
                <div className="card">
                  <div className="section-title">SIGNAL EXPLANATION</div>
                  <p style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.8, fontFamily:'var(--font-sans)', margin:0 }}>{a.explanation}</p>
                </div>
              )}

              {/* Follow-through */}
              <div>
                <div className="section-title">FOLLOW-THROUGH OBSERVATIONS</div>
                {ft.length === 0 ? (
                  <div style={{ fontSize:11, color:'var(--text-muted)', padding:'8px 0' }}>
                    No follow-through data yet. The scheduler re-prices this alert at 1/3/5/10/20-day intervals.
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>INTERVAL</th><th>CHECK DATE</th><th>PRICE</th>
                          <th>RETURN</th><th>REL VOL</th><th>HELD SIDE</th><th>OUTCOME</th>
                        </tr>
                      </thead>
                      <tbody>{ft.map(f => <FtRow key={f.id} ft={f}/>)}</tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Outcome override */}
              <div className="card">
                <div className="section-title">OUTCOME LABEL</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <OutcomeBadge label={a.outcome_label}/>
                  {!editing ? (
                    <button className="btn btn-muted btn-sm" onClick={()=>setEditing(true)}>✎ OVERRIDE</button>
                  ) : (
                    <>
                      <select className="ctrl-select" value={newOutcome} onChange={e=>setNewOutcome(e.target.value)}>
                        {OUTCOME_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <button className="btn btn-success btn-sm" onClick={saveOutcome} disabled={saving}>
                        {saving ? 'SAVING…' : '✓ SAVE'}
                      </button>
                      <button className="btn btn-muted btn-sm" onClick={()=>setEditing(false)}>CANCEL</button>
                    </>
                  )}
                  <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>
                    Automated by scheduler at 1/3/5/10/20-day intervals · Manual override persists
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage({ showToast }) {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sortKey, setSortKey] = useState('alert_date');
  const [sortDir, setSortDir] = useState('desc');

  const [fDir,     setFDir]     = useState('Any Direction');
  const [fOutcome, setFOutcome] = useState('Any Outcome');
  const [fStatus,  setFStatus]  = useState('Any Status');
  const [fSearch,  setFSearch]  = useState('');
  const [page,     setPage]     = useState(0);
  const PER_PAGE = 50;

  const load = useCallback(() => {
    setLoading(true);
    listAlerts({ limit:500 })
      .then(d => { setAlerts(d.alerts||[]); setLoading(false); })
      .catch(err => { showToast('Load Error', err.message, 'error'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSort(k) {
    if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }
  const th = (l, sk) => <SortTh label={l} sk={sk} sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>;

  let filtered = [...alerts];
  if (fDir !== 'Any Direction')   filtered = filtered.filter(a => a.direction === fDir.split(' ')[0]);
  if (fOutcome !== 'Any Outcome') filtered = filtered.filter(a => a.outcome_label === fOutcome);
  if (fStatus !== 'Any Status')   filtered = filtered.filter(a => a.status === fStatus);
  if (fSearch) { const q = fSearch.toLowerCase(); filtered = filtered.filter(a => a.ticker?.toLowerCase().includes(q) || a.company?.toLowerCase().includes(q)); }

  filtered.sort((a,b) => {
    const d = sortDir==='asc'?1:-1;
    const va=a[sortKey], vb=b[sortKey];
    if (va==null) return 1; if (vb==null) return -1;
    return typeof va==='string' ? va.localeCompare(vb)*d : (va-vb)*d;
  });

  const paginated = filtered.slice(page*PER_PAGE, (page+1)*PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const hasFilters = fDir!=='Any Direction'||fOutcome!=='Any Outcome'||fStatus!=='Any Status'||fSearch;

  const confirmed = alerts.filter(a=>a.outcome_label==='Confirmed').length;
  const failed    = alerts.filter(a=>a.outcome_label==='Failed').length;
  const active    = alerts.filter(a=>a.outcome_label==='Still Active').length;
  const cr5 = confirmed+failed > 0 ? Math.round((confirmed/(confirmed+failed))*100) : null;

  return (
    <div style={{ paddingBottom:40 }}>
      {selected && <AlertModal alertId={selected} onClose={()=>setSelected(null)} showToast={showToast}/>}

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item"><span>Total Alerts:</span><span className="stat-val stat-info">{alerts.length}</span></div>
        <div className="stat-item"><span>Active:</span><span className="stat-val stat-ok">{active}</span></div>
        <div className="stat-item"><span>Confirmed:</span><span className="stat-val stat-ok">{confirmed}</span></div>
        <div className="stat-item"><span>Failed:</span><span className="stat-val stat-err">{failed}</span></div>
        {cr5!=null && <div className="stat-item"><span>Confirm Rate:</span><span className="stat-val" style={{ color:cr5>=60?'var(--green)':cr5>=40?'var(--amber)':'var(--red)' }}>{cr5}%</span></div>}
        <div className="stat-item" style={{ marginLeft:'auto' }}>
          <span style={{ fontSize:10, color:'var(--text-muted)' }}>Outcomes confirmed at 5D by scheduler</span>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-row" style={{ padding:'6px 16px' }}>
        <select className={`ctrl-select${fDir!=='Any Direction'?' active':''}`} value={fDir} onChange={e=>{setFDir(e.target.value);setPage(0);}}>
          {DIR_OPTS.map(o=><option key={o}>{o}</option>)}
        </select>
        <select className={`ctrl-select${fStatus!=='Any Status'?' active':''}`} value={fStatus} onChange={e=>{setFStatus(e.target.value);setPage(0);}}>
          {STATUS_OPTS.map(o=><option key={o}>{o}</option>)}
        </select>
        <select className={`ctrl-select${fOutcome!=='Any Outcome'?' active':''}`} value={fOutcome} onChange={e=>{setFOutcome(e.target.value);setPage(0);}}>
          {OUTCOME_OPTS.map(o=><option key={o}>{o}</option>)}
        </select>
        <input className="ctrl-search" placeholder="Ticker / company…" value={fSearch}
          onChange={e=>{setFSearch(e.target.value);setPage(0);}}/>
        {hasFilters && <button className="btn btn-danger btn-sm" onClick={()=>{setFDir('Any Direction');setFOutcome('Any Outcome');setFStatus('Any Status');setFSearch('');setPage(0);}}>✕ CLEAR</button>}
        <span className="ctrl-count">{filtered.length} alerts</span>
        {totalPages>1 && (
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <button className="btn btn-muted btn-sm" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>◀</button>
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>{page+1}/{totalPages}</span>
            <button className="btn btn-muted btn-sm" onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}>▶</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
      ) : filtered.length===0 ? (
        <EmptyState icon="🔔" title={hasFilters?'No Alerts Match Filters':'No Alerts Yet'}
          sub={hasFilters?'Try relaxing the filters.':'Alerts are created when scans detect crossing events. Run a scan from the Dashboard first.'}/>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {th('DATE','alert_date')}{th('SCORE','signal_score')}{th('TICKER','ticker')}
                <th>COMPANY</th><th>DIR</th><th>STATUS</th>
                {th('PRICE','price')}{th('DIST%','dist_pct')}{th('REL VOL','rel_vol_20')}
                {th('5D RET','ret_5d')}<th>FT 1D</th><th>FT 5D</th><th>FT 10D</th>
                <th>OUTCOME</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(a => (
                <tr key={a.id} onClick={()=>setSelected(a.id)}>
                  <td style={{ color:'var(--text-muted)', fontSize:10 }}>{a.alert_date}</td>
                  <td><ScoreBar score={a.signal_score??0}/></td>
                  <td style={{ fontWeight:700, color:a.direction==='Bullish'?'var(--green)':a.direction==='Bearish'?'var(--red)':'var(--text)' }}>{a.ticker}</td>
                  <td style={{ maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', color:'var(--text-dim)', fontFamily:'var(--font-sans)', fontSize:11 }}>{a.company}</td>
                  <td><DirTag dir={a.direction}/></td>
                  <td><StatusBadge code={a.status}/></td>
                  <td style={{ fontWeight:600 }}>{fmtPrice(a.price)}</td>
                  <td className={a.dist_pct>=0?'pos':'neg'}>{fmtPct(a.dist_pct)}</td>
                  <td><RvolCell rv={a.rel_vol_20}/></td>
                  <td className={a.ret_5d>=0?'pos':'neg'}>{fmtPct(a.ret_5d)}</td>
                  <td style={{ fontSize:10, color:a.ft_1d_done?'var(--green)':'var(--text-muted)' }}>{a.ft_1d_done?'✓':'—'}</td>
                  <td style={{ fontSize:10, color:a.ft_5d_done?'var(--green)':'var(--text-muted)' }}>{a.ft_5d_done?'✓':'—'}</td>
                  <td style={{ fontSize:10, color:a.ft_10d_done?'var(--green)':'var(--text-muted)' }}>{a.ft_10d_done?'✓':'—'}</td>
                  <td><OutcomeBadge label={a.outcome_label}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
