-- ═══════════════════════════════════════════════════════════════════════════
-- 50-DAY SMA CROSSING ENGINE — PostgreSQL Schema
-- Run: psql $DATABASE_URL -f schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ─── SCAN SNAPSHOTS ──────────────────────────────────────────────────────────
-- One record per scan run (header only — full results in alerts table)
CREATE TABLE IF NOT EXISTS scans (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_date         DATE        NOT NULL,
  scan_time         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tier              VARCHAR(2)  NOT NULL CHECK (tier IN ('T1','T2','T3','T4')),
  trigger_type      VARCHAR(20) NOT NULL DEFAULT 'manual'
                    CHECK (trigger_type IN ('manual','scheduled','api')),
  job_name          VARCHAR(50),           -- e.g. 'morning_brief', 'eod_scan'
  universe_size     INTEGER,
  scanned_count     INTEGER     DEFAULT 0,
  failed_count      INTEGER     DEFAULT 0,
  skipped_count     INTEGER     DEFAULT 0,
  regime_label      VARCHAR(20),
  pct_above_50dma   DECIMAL(5,2),
  above_crosses     INTEGER     DEFAULT 0,
  below_crosses     INTEGER     DEFAULT 0,
  high_rvol_count   INTEGER     DEFAULT 0,
  extreme_rvol_count INTEGER    DEFAULT 0,
  testing_count     INTEGER     DEFAULT 0,
  rejected_count    INTEGER     DEFAULT 0,
  top_score         INTEGER,
  duration_seconds  INTEGER,               -- how long the scan took
  liquidity_cfg     JSONB,                 -- liquidity filters used
  status            VARCHAR(20) NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','complete','failed','cancelled')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ALERTS (individual crossing events) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id             UUID        REFERENCES scans(id) ON DELETE CASCADE,
  alert_date          DATE        NOT NULL,
  ticker              VARCHAR(10) NOT NULL,
  company             VARCHAR(100),
  exchange            VARCHAR(10),
  sector              VARCHAR(50),
  industry            VARCHAR(50),
  -- Signal classification
  status              VARCHAR(2)  NOT NULL,  -- CA,CB,FA,FB,RC,LS,RJ,TB,TA,HA,HB,NA
  direction           VARCHAR(10) NOT NULL   CHECK (direction IN ('Bullish','Bearish','Neutral')),
  signal_score        INTEGER     CHECK (signal_score BETWEEN 0 AND 100),
  -- Price data
  price               DECIMAL(12,4),
  sma50               DECIMAL(12,4),
  prev_close          DECIMAL(12,4),
  day_high            DECIMAL(12,4),
  day_low             DECIMAL(12,4),
  day_open            DECIMAL(12,4),
  -- Derived metrics
  dist_pct            DECIMAL(8,4),          -- % distance from 50DMA
  prev_close_vs_50    DECIMAL(8,4),          -- prior close vs 50DMA %
  close_location      DECIMAL(5,4),          -- 0-1 position in day range
  days_on_prev_side   INTEGER,               -- days above/below before cross
  -- Volume
  volume              BIGINT,
  avg_vol_20          BIGINT,
  avg_vol_50          BIGINT,
  rel_vol_20          DECIMAL(8,4),
  rel_vol_50          DECIMAL(8,4),
  -- Returns (at time of alert)
  ret_5d              DECIMAL(8,4),
  ret_10d             DECIMAL(8,4),
  -- Score sub-components
  score_crossing_quality  INTEGER,
  score_rel_vol           INTEGER,
  score_close_loc         INTEGER,
  score_distance          INTEGER,
  score_prior_context     INTEGER,
  -- Context
  regime_at_alert     VARCHAR(20),           -- regime when alert fired
  pct_above_at_alert  DECIMAL(5,2),          -- breadth when alert fired
  -- Text
  explanation         TEXT,
  -- Outcome tracking
  outcome_label       VARCHAR(30) NOT NULL DEFAULT 'Still Active'
                      CHECK (outcome_label IN (
                        'Still Active','Confirmed','Failed','Reversed',
                        'Inconclusive','Low-Volume Noise','Data Issue','Expired'
                      )),
  -- Follow-through completion flags
  ft_1d_done          BOOLEAN DEFAULT FALSE,
  ft_3d_done          BOOLEAN DEFAULT FALSE,
  ft_5d_done          BOOLEAN DEFAULT FALSE,
  ft_10d_done         BOOLEAN DEFAULT FALSE,
  ft_20d_done         BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── FOLLOW-THROUGH OBSERVATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS followthrough (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id          UUID        NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  ticker            VARCHAR(10) NOT NULL,
  alert_date        DATE        NOT NULL,
  check_date        DATE        NOT NULL,
  days_since        INTEGER     NOT NULL CHECK (days_since IN (1,3,5,10,20)),
  -- Price at follow-up
  price             DECIMAL(12,4),
  sma50             DECIMAL(12,4),
  volume            BIGINT,
  rel_vol_20        DECIMAL(8,4),
  close_location    DECIMAL(5,4),
  -- Outcome metrics
  return_pct        DECIMAL(8,4),            -- return since alert date
  held_new_side     BOOLEAN,                 -- still above/below 50DMA?
  dist_pct          DECIMAL(8,4),            -- distance from 50DMA at follow-up
  outcome_label     VARCHAR(30)
                    CHECK (outcome_label IN (
                      'Confirmed','Failed','Reversed','Inconclusive',
                      'Low-Volume Noise','Data Issue'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alert_id, days_since)             -- one follow-up per interval
);

-- ─── DAILY REGIME LOG ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regime_log (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_date          DATE        UNIQUE NOT NULL,
  pct_above_50dma   DECIMAL(5,2),
  stocks_above      INTEGER,
  stocks_below      INTEGER,
  above_crosses     INTEGER     DEFAULT 0,
  below_crosses     INTEGER     DEFAULT 0,
  net_crosses       INTEGER     DEFAULT 0,
  high_rvol_above   INTEGER     DEFAULT 0,
  high_rvol_below   INTEGER     DEFAULT 0,
  extreme_rvol      INTEGER     DEFAULT 0,
  regime_label      VARCHAR(20),
  prev_regime       VARCHAR(20),
  regime_changed    BOOLEAN     DEFAULT FALSE,
  tier_used         VARCHAR(2),
  scan_id           UUID        REFERENCES scans(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PATTERN PERFORMANCE STATS ───────────────────────────────────────────────
-- Recalculated nightly by the performance job
CREATE TABLE IF NOT EXISTS performance_stats (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  computed_date       DATE        NOT NULL,
  -- Grouping dimensions
  status_type         VARCHAR(2)  NOT NULL,
  direction           VARCHAR(10),
  sector              VARCHAR(50),
  rvol_bucket         VARCHAR(20),           -- 'Under 1x','1-1.5x','1.5-2x','2-3x','3x+'
  score_bracket       INTEGER,               -- 30,40,50,60,70,80,90
  -- Sample size
  total_signals       INTEGER     DEFAULT 0,
  -- Confirm rates (% that held new side of 50DMA)
  confirm_rate_1d     DECIMAL(5,2),
  confirm_rate_3d     DECIMAL(5,2),
  confirm_rate_5d     DECIMAL(5,2),
  confirm_rate_10d    DECIMAL(5,2),
  confirm_rate_20d    DECIMAL(5,2),
  -- Average returns
  avg_return_1d       DECIMAL(8,4),
  avg_return_3d       DECIMAL(8,4),
  avg_return_5d       DECIMAL(8,4),
  avg_return_10d      DECIMAL(8,4),
  avg_return_20d      DECIMAL(8,4),
  -- Median returns
  med_return_5d       DECIMAL(8,4),
  med_return_10d      DECIMAL(8,4),
  -- Vol at signal
  avg_rvol_at_signal  DECIMAL(8,4),
  -- Score accuracy (correlation of score with confirm rate)
  score_accuracy      DECIMAL(5,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (computed_date, status_type, sector, rvol_bucket, score_bracket)
);

-- ─── SCORE WEIGHTS (recalibrated nightly) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_weights (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  computed_date   DATE        NOT NULL,
  factor          VARCHAR(30) NOT NULL,
  weight          DECIMAL(6,4) NOT NULL,
  prev_weight     DECIMAL(6,4),
  data_points     INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (computed_date, factor)
);

-- Insert default weights on first run
INSERT INTO score_weights (computed_date, factor, weight, notes)
VALUES
  (CURRENT_DATE, 'crossing_quality',  0.45, 'Initial — not yet calibrated'),
  (CURRENT_DATE, 'rel_vol',           0.35, 'Initial — not yet calibrated'),
  (CURRENT_DATE, 'close_location',    0.10, 'Initial — not yet calibrated'),
  (CURRENT_DATE, 'distance',          0.05, 'Initial — not yet calibrated'),
  (CURRENT_DATE, 'prior_context',     0.05, 'Initial — not yet calibrated')
ON CONFLICT (computed_date, factor) DO NOTHING;

-- ─── SCHEDULER JOB LOG ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_log (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name      VARCHAR(50) NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  duration_ms   INTEGER,
  status        VARCHAR(20) NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','success','failed','skipped')),
  result_summary JSONB,
  error_message  TEXT
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scans_date       ON scans(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status     ON scans(status);

CREATE INDEX IF NOT EXISTS idx_alerts_date      ON alerts(alert_date DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_ticker    ON alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_alerts_status    ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_direction ON alerts(direction);
CREATE INDEX IF NOT EXISTS idx_alerts_score     ON alerts(signal_score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_scan_id   ON alerts(scan_id);
CREATE INDEX IF NOT EXISTS idx_alerts_outcome   ON alerts(outcome_label);
CREATE INDEX IF NOT EXISTS idx_alerts_ft_pending ON alerts(alert_date)
  WHERE ft_20d_done = FALSE AND outcome_label = 'Still Active';

CREATE INDEX IF NOT EXISTS idx_ft_alert_id      ON followthrough(alert_id);
CREATE INDEX IF NOT EXISTS idx_ft_check_date    ON followthrough(check_date DESC);
CREATE INDEX IF NOT EXISTS idx_ft_ticker        ON followthrough(ticker);

CREATE INDEX IF NOT EXISTS idx_regime_date      ON regime_log(log_date DESC);

CREATE INDEX IF NOT EXISTS idx_perf_status      ON performance_stats(status_type);
CREATE INDEX IF NOT EXISTS idx_perf_computed    ON performance_stats(computed_date DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_name        ON job_log(job_name, started_at DESC);

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scans_updated  BEFORE UPDATE ON scans  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── USEFUL VIEWS ─────────────────────────────────────────────────────────────

-- Active alerts pending follow-through
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT
  a.id, a.alert_date, a.ticker, a.company, a.sector, a.direction,
  a.status, a.signal_score, a.price, a.sma50, a.dist_pct,
  a.rel_vol_20, a.outcome_label,
  a.ft_1d_done, a.ft_3d_done, a.ft_5d_done, a.ft_10d_done, a.ft_20d_done,
  NOW()::DATE - a.alert_date AS days_since_alert
FROM alerts a
WHERE a.outcome_label = 'Still Active'
  AND a.ft_20d_done = FALSE
  AND a.alert_date >= NOW()::DATE - 25
ORDER BY a.alert_date DESC, a.signal_score DESC;

-- Latest scan summary
CREATE OR REPLACE VIEW v_latest_scan AS
SELECT s.*, COUNT(a.id) AS total_alerts
FROM scans s
LEFT JOIN alerts a ON a.scan_id = s.id
WHERE s.status = 'complete'
GROUP BY s.id
ORDER BY s.scan_time DESC
LIMIT 1;

-- Signal performance summary (most recent stats)
CREATE OR REPLACE VIEW v_performance_summary AS
SELECT DISTINCT ON (status_type, sector)
  status_type, sector,
  total_signals, confirm_rate_5d, confirm_rate_10d,
  avg_return_5d, avg_return_10d, avg_rvol_at_signal
FROM performance_stats
WHERE total_signals >= 5
ORDER BY status_type, sector, computed_date DESC;
