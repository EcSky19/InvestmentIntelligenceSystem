import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  KpiCard, ScoreBar, StatusBadge, DirTag, RvolCell, SortTh, EmptyState, Spinner,
  fmt, fmtPct, fmtPrice, fmtRvol, fmtVol, STATUS_CODES, scoreColor
} from '../components/ToastContainer.jsx';
import { triggerScan, getLatestScan, getDashboard } from '../api/client.js';

const CROSSING_OPTS = ['Any','Crossing Above 50-Day SMA','Crossing Below 50-Day SMA','First Close Above 50-Day SMA','First Close Below 50-Day SMA','Testing From Below','Testing From Above','Holding Above 50-Day SMA','Holding Below 50-Day SMA','Rejected At 50-Day SMA','Reclaimed 50-Day SMA','Lost 50-Day SMA'];
const RVOL_OPTS     = ['Any','Rel Vol Under 0.5','Rel Vol Under 1','Rel Vol Over 0.5','Rel Vol Over 1','Rel Vol Over 1.5','Rel Vol Over 2','Rel Vol Over 3','Rel Vol Over 5','Rel Vol Over 10'];
const DIR_OPTS      = ['Any Direction','Bullish Only','Bearish Only','Neutral / Testing Only'];
const TIER_OPTS     = ['T1','T2','T3','T4'];
const BATCH_OPTS    = [{ v:'25', l:'25 · Safest' },{ v:'50', l:'50 · Default' },{ v:'100', l:'100 · Fast' }];
const SECTORS       = ['All Sectors','Technology','Communication Services','Consumer Discretionary','Consumer Staples','Financials','Healthcare','Industrials','Energy','Utilities','Materials','Real Estate'];

function rvolPass(rv, opt) {
  if (opt==='Any'||rv==null) return true;
  if (opt.includes('Under')) return rv < parseFloat(opt.split('Under ')[1]);
  if (opt.includes('Over'))  return rv > parseFloat(opt.split('Over ')[1]);
  return true;
}

const STATUS_PRIORITY = {CA:1,FA:1,RC:1,CB:1,FB:1,LS:1,RJ:2,TB:3,TA:3,HA:4,HB:4,NA:5};

function sortResults(results, key, dir) {
  const d = dir==='asc'?1:-1;
  return [...results].sort((a,b) => {
    if (key==='default') {
      const pa=STATUS_PRIORITY[a.status]||5, pb=STATUS_PRIORITY[b.status]||5;
      if (pa!==pb) return pa-pb;
      return ((b.rel_vol_20||b.relVol20||0)) - ((a.rel_vol_20||a.relVol20||0));
    }
    const va = a[key], vb = b[key];
    if (va==null) return 1; if (vb==null) return -1;
    if (typeof va==='string') return va.localeCompare(vb)*d;
    return (va-vb)*d;
  });
}

export default function DashboardPage({ showToast, setLastScan, setRegime }) {
  const [results,  setResults]  = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [scanStats, setScanStats] = useState(null);
  const [scanProgress, setScanProgress] = useState({ pct:0, msg:'' });
  const [lastAlert, setLastAlert] = useState(null);
  const [diff, setDiff] = useState(null);
  const [kpiFilter, setKpiFilter] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);

  const [tier,    setTier]    = useState('T1');
  const [batchSz, setBatchSz] = useState('50');
  const [fSector,   setFSector]   = useState('All Sectors');
  const [fCrossing, setFCrossing] = useState('Any');
  const [fRvol,     setFRvol]     = useState('Any');
  const [fDir,      setFDir]      = useState('Any Direction');
  const [fSearch,   setFSearch]   = useState('');
  const [sortKey,   setSortKey]   = useState('default');
  const [sortDir,   setSortDir]   = useState('desc');

  const cancelFnRef = useRef(null);
  const prevScanRef = useRef({});

  // Load latest scan on mount
  useEffect(() => {
    getLatestScan().then(({ scan, alerts }) => {
      if (alerts?.length) {
        setResults(alerts);
        setScanStats(scan);
        setLastScan(scan?.scan_time);
        if (scan?.regime_label) setRegime({ regime_label: scan.regime_label, pct_above_50dma: scan.pct_above_50dma });
      }
    }).catch(() => {});
  }, []);

  function handleSort(key) {
    if (sortKey===key) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function startScan() {
    if (scanning) return;
    setScanning(true); setScanPaused(false);
    setResults([]); setDiff(null); setLastAlert(null);
    setScanProgress({ pct:0, msg:'Starting…' });

    const liveResults = [];
    const prevMap = prevScanRef.current;

    const cancel = triggerScan(
      { tier, batchSize: parseInt(batchSz) },
      (event, data) => {
        if (event==='progress') {
          setScanProgress({ pct: data.pct, msg: data.msg });
        } else if (event==='result') {
          if (!liveResults.find(r => r.ticker === data.ticker)) liveResults.push(data);
          if (['CA','FA','RC','CB','FB','LS','RJ'].includes(data.status)) {
            setLastAlert(data);
          }
          if (liveResults.length % 5 === 0) setResults([...liveResults]);
        } else if (event==='complete') {
          // Compute diff
          const newAbove=[], newBelow=[], highRvol=[], rejected=[], testing=[];
          for (const r of liveResults) {
            const prevStatus = prevMap[r.ticker];
            const isNew = !prevStatus || prevStatus !== r.status;
            if (isNew && ['CA','FA','RC'].includes(r.status)) newAbove.push(r.ticker);
            if (isNew && ['CB','FB','LS'].includes(r.status)) newBelow.push(r.ticker);
            if ((r.relVol20||r.rel_vol_20||0)>2 && ['CA','FA','RC','CB','FB','LS'].includes(r.status)) highRvol.push(r.ticker);
            if (r.status==='RJ') rejected.push(r.ticker);
            if (['TB','TA'].includes(r.status)) testing.push(r.ticker);
            prevMap[r.ticker] = r.status;
          }
          setDiff({ newAbove, newBelow, highRvol, rejected, testing });
          prevScanRef.current = prevMap;
          setResults(sortResults(liveResults,'default','desc'));
          setScanStats(data);
          setLastScan(new Date().toLocaleTimeString());
          if (data.regime) setRegime({ regime_label: data.regime.label, pct_above_50dma: data.regime.pctAbove });
          setScanning(false); setScanPaused(false);
          showToast('Scan Complete', `${data.stats?.scanned||0} scanned · ${data.stats?.aboveCrosses||0}↑ · ${data.stats?.belowCrosses||0}↓`, 'success');
        } else if (event==='error') {
          setScanning(false); setScanPaused(false);
          showToast('Scan Error', data.message, 'error', 6000);
        }
      }
    );
    cancelFnRef.current = cancel;
  }

  function cancelScan() {
    if (cancelFnRef.current) { cancelFnRef.current(); cancelFnRef.current = null; }
    setScanning(false); setScanPaused(false);
    showToast('Scan Cancelled', '', 'warn');
  }

  const displayResults = useMemo(() => {
    let r = [...results];
    if (fSector !== 'All Sectors') r = r.filter(x => (x.sector||x.sector) === fSector);
    if (fCrossing !== 'Any') {
      const code = Object.entries(STATUS_CODES).find(([,v]) => v === fCrossing)?.[0];
      if (code) r = r.filter(x => x.status === code);
    }
    r = r.filter(x => rvolPass(x.rel_vol_20 ?? x.relVol20, fRvol));
    if (fDir === 'Bullish Only')          r = r.filter(x => x.direction === 'Bullish');
    else if (fDir === 'Bearish Only')     r = r.filter(x => x.direction === 'Bearish');
    else if (fDir === 'Neutral / Testing Only') r = r.filter(x => x.direction === 'Neutral');
    if (fSearch) { const q = fSearch.toLowerCase(); r = r.filter(x => x.ticker?.toLowerCase().includes(q) || x.company?.toLowerCase().includes(q)); }
    if (kpiFilter === 'above')   r = r.filter(x => ['CA','FA','RC'].includes(x.status));
    if (kpiFilter === 'below')   r = r.filter(x => ['CB','FB','LS'].includes(x.status));
    if (kpiFilter === 'hirvol')  r = r.filter(x => (x.rel_vol_20||x.relVol20||0) > 1.5);
    if (kpiFilter === 'extreme') r = r.filter(x => (x.rel_vol_20||x.relVol20||0) > 3);
    if (kpiFilter === 'testing') r = r.filter(x => ['TB','TA'].includes(x.status));
    if (kpiFilter === 'rejected')r = r.filter(x => x.status === 'RJ');
    return sortResults(r, sortKey, sortDir);
  }, [results, fSector, fCrossing, fRvol, fDir, fSearch, sortKey, sortDir, kpiFilter]);

  const kpiAbove   = results.filter(r=>['CA','FA','RC'].includes(r.status)).length;
  const kpiBelow   = results.filter(r=>['CB','FB','LS'].includes(r.status)).length;
  const kpiHiRvol  = results.filter(r=>(r.rel_vol_20||r.relVol20||0)>1.5).length;
  const kpiExtreme = results.filter(r=>(r.rel_vol_20||r.relVol20||0)>3).length;
  const kpiTesting = results.filter(r=>['TB','TA'].includes(r.status)).length;
  const kpiRejected= results.filter(r=>r.status==='RJ').length;

  const hasFilters = fSector!=='All Sectors'||fCrossing!=='Any'||fRvol!=='Any'||fDir!=='Any Direction'||fSearch||kpiFilter;

  const th = (label, sk) => (
    <SortTh label={label} sk={sk} sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>
  );

  return (
    <>
      {/* LIVE SCAN OVERLAY */}
      {scanning && (
        <div className="scan-overlay">
          <div className="scan-box">
            <div className="scan-title">50-DAY SMA CROSSING ENGINE</div>
            <div style={{textAlign:'center',fontSize:10,color:'var(--text-muted)',marginTop:-8}}>
              SCANNING {tier} UNIVERSE
            </div>
            <div>
              <div className="scan-progress-track">
                <div className="scan-progress-fill" style={{width:`${scanProgress.pct}%`}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text-muted)',marginTop:4}}>
                <span>{scanProgress.msg}</span>
                <span>{scanProgress.pct}%</span>
              </div>
            </div>
            <div className="scan-stats-grid">
              <div className="scan-stat-card ok"><div className="s-l">Results</div><div className="s-v">{results.length}</div></div>
              <div className="scan-stat-card info"><div className="s-l">Above</div><div className="s-v">{kpiAbove}</div></div>
              <div className="scan-stat-card" style={{}}><div className="s-l" style={{color:'var(--red)'}}>Below</div><div className="s-v" style={{color:'var(--red)'}}>{kpiBelow}</div></div>
              <div className="scan-stat-card"><div className="s-l">Hi RVol</div><div className="s-v" style={{color:'var(--blue)'}}>{kpiHiRvol}</div></div>
            </div>
            {lastAlert && (
              <div className="scan-latest">
                <Spinner size={14}/>
                <span style={{color:'var(--text-muted)'}}>LAST ALERT:</span>
                <span style={{fontWeight:700,color:lastAlert.direction==='Bullish'?'var(--green)':'var(--red)'}}>{lastAlert.ticker}</span>
                <StatusBadge code={lastAlert.status}/>
                <RvolCell rv={lastAlert.rel_vol_20||lastAlert.relVol20}/>
                <span style={{marginLeft:'auto',fontSize:9,color:'var(--text-muted)'}}>Score: {lastAlert.signal_score||lastAlert.signalScore}</span>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'center',gap:12}}>
              <button className="scan-action-btn cancel" onClick={cancelScan}>✕ CANCEL</button>
            </div>
            <div style={{fontSize:10,color:'var(--text-muted)',textAlign:'center'}}>
              Results streaming live below ↓ · Scan runs on server — closing this tab is safe
            </div>
          </div>
        </div>
      )}

      {/* KPI ROW */}
      <div className="kpi-row">
        <KpiCard label="CROSSED ABOVE" value={kpiAbove} sub="Bullish crossings" color="green" onClick={()=>setKpiFilter(f=>f==='above'?null:'above')} active={kpiFilter==='above'}/>
        <KpiCard label="CROSSED BELOW" value={kpiBelow} sub="Bearish crossings" color="red"   onClick={()=>setKpiFilter(f=>f==='below'?null:'below')} active={kpiFilter==='below'}/>
        <KpiCard label="HIGH REL VOL"  value={kpiHiRvol}  sub="RVol over 1.5x" color="blue"  onClick={()=>setKpiFilter(f=>f==='hirvol'?null:'hirvol')} active={kpiFilter==='hirvol'}/>
        <KpiCard label="EXTREME RVOL"  value={kpiExtreme} sub="RVol over 3x"   color="teal"  onClick={()=>setKpiFilter(f=>f==='extreme'?null:'extreme')} active={kpiFilter==='extreme'}/>
        <KpiCard label="TESTING 50DMA" value={kpiTesting}  sub="Within 1.5%"   color="purple" onClick={()=>setKpiFilter(f=>f==='testing'?null:'testing')} active={kpiFilter==='testing'}/>
        <KpiCard label="REJECTED"      value={kpiRejected} sub="Failed at 50DMA" color="orange" onClick={()=>setKpiFilter(f=>f==='rejected'?null:'rejected')} active={kpiFilter==='rejected'}/>
        <KpiCard label="TOTAL RESULTS" value={results.length} sub={scanStats?`Tier ${scanStats.tier||tier} scan`:'No scan yet'} color="muted"/>
        <KpiCard label="TOP SCORE"     value={results.reduce((m,r)=>Math.max(m,r.signal_score||r.signalScore||0),0)||'—'} sub="Highest signal score" color="muted"/>
      </div>

      {/* SCAN STATS */}
      {scanStats && (
        <div className="stats-bar">
          <div className="stat-item"><span>Source:</span><span className="stat-val stat-ok">Massive Stocks API</span></div>
          <div className="stat-item"><span>Freshness:</span><span className="stat-val stat-warn">15-MIN DELAYED</span></div>
          <div className="stat-item"><span>Tier:</span><span className="stat-val stat-info">{scanStats.tier||tier}</span></div>
          <div className="stat-item"><span>Scanned:</span><span className="stat-val stat-ok">{scanStats.scanned_count||0}</span></div>
          <div className="stat-item"><span>Failed:</span><span className={`stat-val ${(scanStats.failed_count||0)>0?'stat-err':'stat-ok'}`}>{scanStats.failed_count||0}</span></div>
          <div className="stat-item"><span>Duration:</span><span className="stat-val">{scanStats.duration_seconds||0}s</span></div>
        </div>
      )}

      {/* DIFF BANNER */}
      {diff && (diff.newAbove.length||diff.newBelow.length||diff.highRvol.length||diff.rejected.length||diff.testing.length) ? (
        <div className="diff-banner">
          {diff.newAbove.length>0&&<div style={{display:'flex',alignItems:'center',gap:6}}><span className="diff-dot green"/><span style={{color:'var(--text-muted)',fontWeight:600,fontSize:10}}>NEW ABOVE:</span>{diff.newAbove.slice(0,10).map(t=><span key={t} className="diff-chip green">{t}</span>)}</div>}
          {diff.newBelow.length>0&&<div style={{display:'flex',alignItems:'center',gap:6}}><span className="diff-dot red"/><span style={{color:'var(--text-muted)',fontWeight:600,fontSize:10}}>NEW BELOW:</span>{diff.newBelow.slice(0,10).map(t=><span key={t} className="diff-chip red">{t}</span>)}</div>}
          {diff.highRvol.length>0&&<div style={{display:'flex',alignItems:'center',gap:6}}><span className="diff-dot blue"/><span style={{color:'var(--text-muted)',fontWeight:600,fontSize:10}}>HIGH RVOL:</span>{diff.highRvol.slice(0,8).map(t=><span key={t} className="diff-chip blue">{t}</span>)}</div>}
          {diff.rejected.length>0&&<div style={{display:'flex',alignItems:'center',gap:6}}><span className="diff-dot orange"/><span style={{color:'var(--text-muted)',fontWeight:600,fontSize:10}}>REJECTED:</span>{diff.rejected.slice(0,6).map(t=><span key={t} className="diff-chip orange">{t}</span>)}</div>}
          {diff.testing.length>0&&<div style={{display:'flex',alignItems:'center',gap:6}}><span className="diff-dot purple"/><span style={{color:'var(--text-muted)',fontWeight:600,fontSize:10}}>TESTING:</span>{diff.testing.slice(0,6).map(t=><span key={t} className="diff-chip purple">{t}</span>)}</div>}
        </div>
      ) : null}

      {/* CONTROLS */}
      <div className="controls-row" style={{padding:'6px 16px'}}>
        <select className={`ctrl-select${tier==='T3'?' active':tier==='T4'?' active':''}`} style={{fontWeight:700,minWidth:200}} value={tier} onChange={e=>setTier(e.target.value)}>
          <option value="T1">T1 · S&P 500 Core (~503)</option>
          <option value="T2">T2 · S&P 500 + NQ100 + NYSE100 (~650)</option>
          <option value="T3">T3 · Liquid US Equities (~900) ⚠</option>
          <option value="T4">T4 · Full Nasdaq + NYSE (~1000) ⚠</option>
        </select>
        <select className="ctrl-select" value={batchSz} onChange={e=>setBatchSz(e.target.value)}>
          {BATCH_OPTS.map(b=><option key={b.v} value={b.v}>{b.l}</option>)}
        </select>
        <select className={`ctrl-select${fSector!=='All Sectors'?' active':''}`} value={fSector} onChange={e=>setFSector(e.target.value)}>
          {SECTORS.map(o=><option key={o}>{o}</option>)}
        </select>
        <select className={`ctrl-select${fCrossing!=='Any'?' active':''}`} value={fCrossing} onChange={e=>setFCrossing(e.target.value)}>
          {CROSSING_OPTS.map(o=><option key={o}>{o}</option>)}
        </select>
        <select className={`ctrl-select${fRvol!=='Any'?' active':''}`} value={fRvol} onChange={e=>setFRvol(e.target.value)}>
          {RVOL_OPTS.map(o=><option key={o}>{o}</option>)}
        </select>
        <select className={`ctrl-select${fDir!=='Any Direction'?' active':''}`} value={fDir} onChange={e=>setFDir(e.target.value)}>
          {DIR_OPTS.map(o=><option key={o}>{o}</option>)}
        </select>
        <input className="ctrl-search" placeholder="Search ticker / company…" value={fSearch} onChange={e=>setFSearch(e.target.value)}/>
        {hasFilters && <button className="btn btn-danger btn-sm" onClick={()=>{setFSector('All Sectors');setFCrossing('Any');setFRvol('Any');setFDir('Any Direction');setFSearch('');setKpiFilter(null);}}>✕ CLEAR</button>}
        <button className={`btn btn-primary${scanning?' scanning':''}`} onClick={scanning?cancelScan:startScan} style={{marginLeft:'auto'}} disabled={false}>
          {scanning ? '✕ CANCEL' : '↕ SCAN NOW'}
        </button>
        <span className="ctrl-count">{displayResults.length} stocks</span>
      </div>

      {/* TABLE */}
      {results.length === 0 && !scanning ? (
        <EmptyState icon="↕" title="No Scan Data"
          sub="Select a Universe Tier and click SCAN NOW. The backend will run the scan and stream results here in real time. Previous scan results load automatically on page open."
        />
      ) : (
        <div className="table-wrap">
          {scanning && results.length > 0 && (
            <div style={{padding:'0 0 8px',fontSize:10,color:'var(--blue)',display:'flex',alignItems:'center',gap:8}}>
              <div className="scan-spinner" style={{width:12,height:12,borderWidth:2}}/>
              Streaming live — {results.length} results so far
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>#</th>
                {th('SCORE','signal_score')}{th('TICKER','ticker')}
                <th>COMPANY</th><th>EXCH</th>{th('SECTOR','sector')}
                {th('DIR','direction')}<th>STATUS</th>
                {th('PRICE','price')}{th('50DMA','sma50')}{th('DIST%','dist_pct')}
                <th>PREV vs 50D</th><th>CUR vs 50D</th>
                {th('REL VOL','rel_vol_20')}{th('VOLUME','volume')}
                <th>AVG VOL</th><th>CL%</th>
                {th('5D RET','ret_5d')}{th('10D RET','ret_10d')}
                <th>MCT</th><th>OUTCOME</th>
              </tr>
            </thead>
            <tbody>
              {displayResults.map((r, i) => {
                const rv = r.rel_vol_20 ?? r.relVol20;
                const score = r.signal_score ?? r.signalScore ?? 0;
                const distPct = r.dist_pct ?? r.distPct;
                const cl = r.close_location ?? r.closeLocation;
                return (
                  <tr key={r.id||r.ticker} className={r.isNew?'flash':''} onClick={()=>setSelectedStock(r)}>
                    <td className="muted" style={{textAlign:'right'}}>{i+1}</td>
                    <td><ScoreBar score={score}/></td>
                    <td className="td-ticker" style={{color:r.direction==='Bullish'?'var(--green)':r.direction==='Bearish'?'var(--red)':'var(--text)'}}>{r.ticker}</td>
                    <td className="td-company">{r.company}</td>
                    <td><span className="exch-badge">{r.exchange}</span></td>
                    <td style={{color:'var(--text-dim)',fontSize:10}}>{r.sector}</td>
                    <td><DirTag dir={r.direction}/></td>
                    <td><StatusBadge code={r.status}/></td>
                    <td style={{fontWeight:600}}>{fmtPrice(r.price)}</td>
                    <td className="muted">{fmtPrice(r.sma50)}</td>
                    <td className={distPct>=0?'pos':'neg'}>{fmtPct(distPct)}</td>
                    <td className={(r.prev_close_vs_50??r.prevCloseVs50)>=0?'pos':'neg'}>{fmtPct(r.prev_close_vs_50??r.prevCloseVs50)}</td>
                    <td className={distPct>=0?'pos':'neg'}>{fmtPct(distPct)}</td>
                    <td><RvolCell rv={rv}/></td>
                    <td className="muted">{fmtVol(r.volume)}</td>
                    <td style={{color:'var(--text-muted)'}}>{fmtVol(r.avg_vol_20??r.avgVol20)}</td>
                    <td className="muted">{cl!=null?fmt(cl*100)+'%':'—'}</td>
                    <td className={(r.ret_5d??r.ret5d)>=0?'pos':'neg'}>{fmtPct(r.ret_5d??r.ret5d)}</td>
                    <td className={(r.ret_10d??r.ret10d)>=0?'pos':'neg'}>{fmtPct(r.ret_10d??r.ret10d)}</td>
                    <td style={{fontSize:9,color:'var(--text-muted)'}}>{r.mc_tier||r.mcTier||'—'}</td>
                    <td style={{fontSize:9,fontWeight:700,color:r.outcome_label==='Confirmed'?'var(--green)':r.outcome_label==='Failed'?'var(--red)':r.outcome_label==='Still Active'?'var(--blue)':'var(--text-muted)'}}>{r.outcome_label||'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
