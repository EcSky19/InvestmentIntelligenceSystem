import React, { useState, useEffect } from 'react';
import { listScans, getScan } from '../api/client.js';
import { ScoreBar, StatusBadge, DirTag, RvolCell, SortTh, EmptyState, Spinner,
  fmt, fmtPct, fmtPrice, fmtVol } from '../components/ToastContainer.jsx';

const DIR_OPTS     = ['Any Direction','Bullish','Bearish','Neutral'];
const STATUS_OPTS  = ['Any Status','CA','FA','RC','CB','FB','LS','RJ','TB','TA','HA','HB'];
const RVOL_OPTS    = ['Any RVol','Over 0.5x','Over 1x','Over 1.5x','Over 2x','Over 3x','Over 5x','Extreme (10x+)'];
const OUTCOME_OPTS = ['Any Outcome','Still Active','Confirmed','Failed','Reversed'];

function rvolPass(rv, opt) {
  if (opt === 'Any RVol' || rv == null) return true;
  const map = { 'Over 0.5x':0.5,'Over 1x':1,'Over 1.5x':1.5,'Over 2x':2,'Over 3x':3,'Over 5x':5,'Extreme (10x+)':10 };
  return rv >= (map[opt] || 0);
}

function regimeCls(l) {
  return l==='Bullish'?'var(--green)':l==='Bearish'?'var(--red)':l==='Neutral'?'var(--purple)':'var(--text-muted)';
}

function ScanRow({ scan, onExpand, expanded }) {
  const date = new Date(scan.scan_time);
  const timeStr = date.toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  return (
    <tr style={{ cursor:'pointer', background: expanded ? 'var(--bg-hover)' : 'var(--bg-row)' }}
        onClick={() => onExpand(scan.id)}>
      <td style={{ color:'var(--text-muted)', fontSize:10 }}>{timeStr}</td>
      <td><span style={{ fontSize:10, fontWeight:700, background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:3, padding:'1px 6px', color:'var(--blue)' }}>{scan.tier}</span></td>
      <td style={{ fontWeight:600, color:'var(--text-dim)' }}>{scan.scanned_count ?? '—'}</td>
      <td style={{ fontWeight:700, color:'var(--green)' }}>{scan.above_crosses ?? 0}</td>
      <td style={{ fontWeight:700, color:'var(--red)' }}>{scan.below_crosses ?? 0}</td>
      <td style={{ color:'var(--blue)' }}>{scan.high_rvol_count ?? 0}</td>
      <td style={{ color:'var(--purple)' }}>{scan.extreme_rvol_count ?? 0}</td>
      <td style={{ fontWeight:700, color: regimeCls(scan.regime_label) }}>{scan.regime_label ?? '—'}</td>
      <td>{scan.pct_above_50dma != null ? fmt(scan.pct_above_50dma, 0)+'%' : '—'}</td>
      <td style={{ color:'var(--text-muted)', fontSize:10 }}>{scan.duration_seconds ?? '—'}s</td>
      <td style={{ fontSize:10, fontWeight:700, color: scan.status==='complete'?'var(--green)':scan.status==='failed'?'var(--red)':'var(--amber)' }}>{(scan.status||'').toUpperCase()}</td>
      <td style={{ textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>{expanded ? '▲' : '▼'}</td>
    </tr>
  );
}

function ScanDetail({ scanId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('signal_score');
  const [sortDir, setSortDir] = useState('desc');
  const [fSearch,  setFSearch]  = useState('');
  const [fDir,     setFDir]     = useState('Any Direction');
  const [fStatus,  setFStatus]  = useState('Any Status');
  const [fRvol,    setFRvol]    = useState('Any RVol');
  const [fOutcome, setFOutcome] = useState('Any Outcome');

  useEffect(() => {
    getScan(scanId).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [scanId]);

  function handleSort(k) {
    if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }

  if (loading) return <tr><td colSpan={12} style={{ padding:'20px', textAlign:'center' }}><Spinner/></td></tr>;
  if (!data)   return <tr><td colSpan={12} style={{ padding:'12px', color:'var(--red)' }}>Failed to load.</td></tr>;

  let filtered = [...(data.alerts||[])];
  if (fSearch)              { const q=fSearch.toLowerCase(); filtered=filtered.filter(a=>a.ticker?.toLowerCase().includes(q)||a.company?.toLowerCase().includes(q)); }
  if (fDir !== 'Any Direction') filtered = filtered.filter(a => a.direction === fDir);
  if (fStatus !== 'Any Status') filtered = filtered.filter(a => a.status === fStatus);
  if (fOutcome !== 'Any Outcome') filtered = filtered.filter(a => a.outcome_label === fOutcome);
  filtered = filtered.filter(a => rvolPass(a.rel_vol_20, fRvol));

  filtered.sort((a,b) => {
    const d = sortDir==='asc'?1:-1;
    const va=a[sortKey], vb=b[sortKey];
    if (va==null) return 1; if (vb==null) return -1;
    return typeof va==='string' ? va.localeCompare(vb)*d : (va-vb)*d;
  });

  const th = (label, sk) => <SortTh label={label} sk={sk} sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>;

  const bullish  = (data.alerts||[]).filter(a=>['CA','FA','RC'].includes(a.status));
  const bearish  = (data.alerts||[]).filter(a=>['CB','FB','LS'].includes(a.status));
  const highRvol = (data.alerts||[]).filter(a=>(a.rel_vol_20||0)>=1.5);
  const extreme  = (data.alerts||[]).filter(a=>(a.rel_vol_20||0)>=3);

  const hasFilters = fSearch||fDir!=='Any Direction'||fStatus!=='Any Status'||fRvol!=='Any RVol'||fOutcome!=='Any Outcome';

  return (
    <tr>
      <td colSpan={12} style={{ padding:0 }}>
        <div style={{ background:'var(--bg-base)', borderTop:'2px solid var(--border-bright)', padding:'12px 16px' }}>

          {/* Summary chips */}
          <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
            {[
              { label:'All', count:(data.alerts||[]).length, color:'var(--text-dim)', filter:()=>{setFDir('Any Direction');setFStatus('Any Status');setFRvol('Any RVol');setFOutcome('Any Outcome');setFSearch('');} },
              { label:'Bullish', count:bullish.length, color:'var(--green)', filter:()=>setFDir('Bullish') },
              { label:'Bearish', count:bearish.length, color:'var(--red)', filter:()=>setFDir('Bearish') },
              { label:'Hi RVol (1.5x+)', count:highRvol.length, color:'var(--blue)', filter:()=>setFRvol('Over 1.5x') },
              { label:'Extreme RVol (3x+)', count:extreme.length, color:'var(--purple)', filter:()=>setFRvol('Over 3x') },
            ].map(({ label, count, color, filter }) => (
              <button key={label} onClick={filter}
                style={{ padding:'3px 10px', borderRadius:4, border:`1px solid ${color}33`, background:`${color}11`,
                  color, fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
                {label} <span style={{ opacity:.7 }}>({count})</span>
              </button>
            ))}
          </div>

          {/* Filter controls */}
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
            <input className="ctrl-search" placeholder="Ticker / company…" value={fSearch} onChange={e=>setFSearch(e.target.value)} style={{ width:160 }}/>
            <select className={`ctrl-select${fDir!=='Any Direction'?' active':''}`} value={fDir} onChange={e=>setFDir(e.target.value)}>
              {DIR_OPTS.map(o=><option key={o}>{o}</option>)}
            </select>
            <select className={`ctrl-select${fStatus!=='Any Status'?' active':''}`} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
              {STATUS_OPTS.map(o=><option key={o}>{o}</option>)}
            </select>
            <select className={`ctrl-select${fRvol!=='Any RVol'?' active':''}`} value={fRvol} onChange={e=>setFRvol(e.target.value)}>
              {RVOL_OPTS.map(o=><option key={o}>{o}</option>)}
            </select>
            <select className={`ctrl-select${fOutcome!=='Any Outcome'?' active':''}`} value={fOutcome} onChange={e=>setFOutcome(e.target.value)}>
              {OUTCOME_OPTS.map(o=><option key={o}>{o}</option>)}
            </select>
            {hasFilters && <button className="btn btn-danger btn-sm" onClick={()=>{setFDir('Any Direction');setFStatus('Any Status');setFRvol('Any RVol');setFOutcome('Any Outcome');setFSearch('');}}>✕ CLEAR</button>}
            <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>{filtered.length} stocks</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ color:'var(--text-muted)', fontSize:11, padding:'12px 0' }}>No alerts match filters.</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table>
                <thead>
                  <tr>
                    {th('SCORE','signal_score')}{th('TICKER','ticker')}
                    <th>COMPANY</th>{th('SECTOR','sector')}<th>DIR</th><th>STATUS</th>
                    {th('PRICE','price')}{th('DIST%','dist_pct')}{th('REL VOL','rel_vol_20')}
                    {th('5D RET','ret_5d')}{th('10D RET','ret_10d')}<th>OUTCOME</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map(r => (
                    <tr key={r.id} style={{ background:'var(--bg-row)', borderBottom:'1px solid var(--border)' }}>
                      <td><ScoreBar score={r.signal_score??0}/></td>
                      <td style={{ fontWeight:700, color:r.direction==='Bullish'?'var(--green)':r.direction==='Bearish'?'var(--red)':'var(--text)' }}>{r.ticker}</td>
                      <td style={{ maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', color:'var(--text-dim)', fontFamily:'var(--font-sans)', fontSize:11 }}>{r.company}</td>
                      <td style={{ color:'var(--text-muted)', fontSize:10 }}>{r.sector}</td>
                      <td><DirTag dir={r.direction}/></td>
                      <td><StatusBadge code={r.status}/></td>
                      <td style={{ fontWeight:600 }}>{fmtPrice(r.price)}</td>
                      <td className={r.dist_pct>=0?'pos':'neg'}>{fmtPct(r.dist_pct)}</td>
                      <td><RvolCell rv={r.rel_vol_20}/></td>
                      <td className={r.ret_5d>=0?'pos':'neg'}>{fmtPct(r.ret_5d)}</td>
                      <td className={r.ret_10d>=0?'pos':'neg'}>{fmtPct(r.ret_10d)}</td>
                      <td style={{ fontSize:9, fontWeight:700, color:r.outcome_label==='Confirmed'?'var(--green)':r.outcome_label==='Failed'?'var(--red)':r.outcome_label==='Still Active'?'var(--blue)':'var(--text-muted)' }}>{r.outcome_label||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && <div style={{ fontSize:10, color:'var(--text-muted)', padding:'8px 0' }}>Showing 500 of {filtered.length}</div>}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ArchivePage({ showToast }) {
  const [scans,   setScans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [page,    setPage]    = useState(0);
  const PER_PAGE = 25;

  useEffect(() => {
    listScans({ limit:200, status:'complete' })
      .then(d => { setScans(d.scans||[]); setLoading(false); })
      .catch(err => { showToast('Archive Error', err.message, 'error'); setLoading(false); });
  }, []);

  function toggle(id) { setExpanded(e => e===id ? null : id); }
  const paginated  = scans.slice(page*PER_PAGE, (page+1)*PER_PAGE);
  const totalPages = Math.ceil(scans.length / PER_PAGE);

  return (
    <div style={{ paddingBottom:40 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14, letterSpacing:'.06em' }}>SCAN ARCHIVE</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{scans.length} completed scans · Click any row to expand · Use filter chips to slice by direction, RVol, outcome</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          {totalPages > 1 && <>
            <button className="btn btn-muted btn-sm" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>◀</button>
            <span style={{ fontSize:10, color:'var(--text-muted)', padding:'4px 8px', lineHeight:2 }}>{page+1} / {totalPages}</span>
            <button className="btn btn-muted btn-sm" onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}>▶</button>
          </>}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
      ) : scans.length === 0 ? (
        <EmptyState icon="📂" title="No Scans Yet" sub="Run your first scan from the Dashboard tab."/>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATE / TIME</th><th>TIER</th><th>SCANNED</th>
                <th style={{color:'var(--green)'}}>↑ ABOVE</th>
                <th style={{color:'var(--red)'}}>↓ BELOW</th>
                <th>HI RVOL</th><th style={{color:'var(--purple)'}}>EXT RVOL</th>
                <th>REGIME</th><th>% ABOVE</th><th>DURATION</th><th>STATUS</th><th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(scan => (
                <React.Fragment key={scan.id}>
                  <ScanRow scan={scan} onExpand={toggle} expanded={expanded===scan.id}/>
                  {expanded === scan.id && <ScanDetail scanId={scan.id}/>}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
