import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

// Basic configuration: backend base URL from env or default local
const DEFAULT_BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Simple helpers for API paths. Adjust if backend path differs.
const api = {
  upload: `${DEFAULT_BACKEND}/upload`,
  sync: `${DEFAULT_BACKEND}/sync`,
  progress: (taskId) => `${DEFAULT_BACKEND}/progress/${encodeURIComponent(taskId)}`,
  download: (taskId) => `${DEFAULT_BACKEND}/download/${encodeURIComponent(taskId)}`,
  history: `${DEFAULT_BACKEND}/history`
};

// PUBLIC_INTERFACE
function App() {
  /** Light theme only, but keep attribute for future extension */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const [videoFile, setVideoFile] = useState(null);
  const [subtitleFile, setSubtitleFile] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | processing | completed | error
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [syncedSubtitleUrl, setSyncedSubtitleUrl] = useState('');
  const [poller, setPoller] = useState(null);

  const isReadyToSync = useMemo(() => !!videoFile && !!subtitleFile, [videoFile, subtitleFile]);

  useEffect(() => {
    // Load initial history
    fetchHistory();
    // Cleanup polling on unmount
    return () => {
      if (poller) clearInterval(poller);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PUBLIC_INTERFACE
  async function fetchHistory() {
    try {
      const res = await fetch(api.history);
      if (!res.ok) throw new Error(`History fetch failed (${res.status})`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      // Non-blocking
      // eslint-disable-next-line no-console
      console.warn('Failed to load history:', err?.message || err);
    }
  }

  // PUBLIC_INTERFACE
  function resetState() {
    setTaskId(null);
    setStatus('idle');
    setMessage('');
    setProgress(0);
    setSyncedSubtitleUrl('');
  }

  // PUBLIC_INTERFACE
  async function handleUploadAndSync(e) {
    e.preventDefault();
    if (!isReadyToSync) return;

    setStatus('uploading');
    setMessage('Uploading files...');
    setProgress(0);

    try {
      // Step 1: upload
      const form = new FormData();
      form.append('video', videoFile);
      form.append('subtitle', subtitleFile);

      const uploadRes = await fetch(api.upload, { method: 'POST', body: form });
      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(text || `Upload failed (${uploadRes.status})`);
      }
      const uploadData = await uploadRes.json();
      const newTaskId = uploadData?.task_id || uploadData?.taskId || uploadData?.id;
      if (!newTaskId) throw new Error('Upload succeeded but no task id returned');
      setTaskId(newTaskId);

      // Step 2: trigger sync
      setStatus('processing');
      setMessage('Processing started...');
      const syncRes = await fetch(api.sync, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: newTaskId })
      });
      if (!syncRes.ok) {
        const text = await syncRes.text();
        throw new Error(text || `Sync failed (${syncRes.status})`);
      }

      // Step 3: start polling progress
      startPolling(newTaskId);
    } catch (err) {
      setStatus('error');
      setMessage(err?.message || 'An unexpected error occurred while starting sync');
    }
  }

  // PUBLIC_INTERFACE
  function startPolling(id) {
    if (poller) clearInterval(poller);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(api.progress(id));
        if (!res.ok) throw new Error(`Progress failed (${res.status})`);
        const data = await res.json();
        const p = Number(data?.progress ?? data?.percent ?? 0);
        const msg = data?.message || data?.status || 'Processing...';

        setProgress(Math.min(100, Math.max(0, p)));
        setMessage(msg);

        if (data?.status === 'completed' || p >= 100) {
          clearInterval(interval);
          setStatus('completed');
          setMessage('Processing completed');
          setSyncedSubtitleUrl(api.download(id));
          fetchHistory();
        } else if (data?.status === 'error') {
          clearInterval(interval);
          setStatus('error');
          setMessage(data?.error || 'Processing error');
        }
      } catch (err) {
        clearInterval(interval);
        setStatus('error');
        setMessage(err?.message || 'Progress polling failed');
      }
    }, 1500);
    setPoller(interval);
  }

  // PUBLIC_INTERFACE
  function handleFileChange(e, type) {
    const file = e.target.files?.[0] || null;
    if (type === 'video') setVideoFile(file);
    if (type === 'subtitle') setSubtitleFile(file);
  }

  // PUBLIC_INTERFACE
  function openDownload() {
    if (syncedSubtitleUrl) {
      window.open(syncedSubtitleUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="App">
      <header style={styles.header}>
        <h1 style={styles.brand}>Subtitle Sync</h1>
      </header>

      <main style={styles.main}>
        <section style={styles.uploadPanel} aria-label="Upload panel">
          <h2 style={styles.sectionTitle}>Upload and Sync</h2>

          <div style={styles.dropRow}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Video file</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileChange(e, 'video')}
                style={styles.fileInput}
              />
              {videoFile && <span style={styles.fileName}>{videoFile.name}</span>}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Subtitle file (.srt, .ass, .ssa, .vtt)</label>
              <input
                type="file"
                accept=".srt,.ass,.ssa,.vtt,text/vtt,application/x-subrip"
                onChange={(e) => handleFileChange(e, 'subtitle')}
                style={styles.fileInput}
              />
              {subtitleFile && <span style={styles.fileName}>{subtitleFile.name}</span>}
            </div>
          </div>

          <div style={styles.actionsRow}>
            <button
              onClick={handleUploadAndSync}
              disabled={!isReadyToSync || status === 'uploading' || status === 'processing'}
              style={{
                ...styles.primaryBtn,
                ...( (!isReadyToSync || status === 'uploading' || status === 'processing') ? styles.disabledBtn : {} )
              }}
              aria-disabled={!isReadyToSync || status === 'uploading' || status === 'processing'}
            >
              {status === 'uploading' ? 'Uploading...' : status === 'processing' ? 'Processing...' : 'Sync Subtitles'}
            </button>

            {status === 'completed' && (
              <button onClick={openDownload} style={styles.accentBtn}>
                Download Synced Subtitle
              </button>
            )}

            {(status === 'error' || status === 'completed') && (
              <button onClick={resetState} style={styles.secondaryBtn}>
                Reset
              </button>
            )}
          </div>

          <div style={styles.statusBox} aria-live="polite">
            {status !== 'idle' && (
              <>
                <div style={styles.progressBarOuter} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <div style={{ ...styles.progressBarInner, width: `${progress}%` }} />
                </div>
                <p style={styles.statusMessage}>{message}</p>
                {taskId && <p style={styles.taskId}>Task: {taskId}</p>}
              </>
            )}
          </div>
        </section>

        <section style={styles.historyPanel} aria-label="Processing history">
          <div style={styles.historyHeader}>
            <h2 style={styles.sectionTitle}>History</h2>
            <button onClick={fetchHistory} style={styles.secondaryBtnSmall}>Refresh</button>
          </div>
          {history?.length === 0 ? (
            <p style={styles.muted}>No processed items yet.</p>
          ) : (
            <ul style={styles.historyList}>
              {history.map((item, idx) => {
                const id = item?.task_id || item?.id || `item-${idx}`;
                const vname = item?.video_name || item?.video || 'Video';
                const sname = item?.subtitle_name || item?.subtitle || 'Subtitle';
                const st = item?.status || 'completed';
                const ts = item?.created_at || item?.timestamp || '';
                const downloadable = st === 'completed';
                return (
                  <li key={id} style={styles.historyItem}>
                    <div style={styles.historyMeta}>
                      <div style={styles.historyTitle}>{vname}</div>
                      <div style={styles.historySub}>{sname}</div>
                      <div style={styles.historyInfo}>
                        <span style={{...styles.badge, ...(st === 'completed' ? styles.badgeSuccess : st === 'processing' ? styles.badgeWarn : styles.badgeDark)}}>
                          {st}
                        </span>
                        {ts && <span style={styles.time}>{String(ts)}</span>}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => window.open(api.download(id), '_blank', 'noopener,noreferrer')}
                        style={{ ...styles.linkBtn, ...(downloadable ? {} : styles.disabledBtn) }}
                        disabled={!downloadable}
                      >
                        Download
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer style={styles.footer}>
        <span style={styles.footerText}>Powered by Whisper-based subtitle synchronization</span>
      </footer>
    </div>
  );
}

const palette = {
  primary: '#1976d2',
  accent: '#ff9800',
  secondary: '#424242',
  bg: '#ffffff',
  bgAlt: '#f5f7fb',
  text: '#212121',
  textMuted: '#666666',
  border: '#e6e8eb'
};

const styles = {
  header: {
    padding: '20px',
    borderBottom: `1px solid ${palette.border}`,
    background: palette.bg,
    position: 'sticky',
    top: 0,
    zIndex: 10
  },
  brand: {
    margin: 0,
    color: palette.primary,
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '0.2px'
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '960px',
    margin: '24px auto',
    padding: '0 16px'
  },
  uploadPanel: {
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.05)'
  },
  historyPanel: {
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.05)'
  },
  sectionTitle: {
    margin: '0 0 16px',
    color: palette.text,
    fontSize: '18px',
    fontWeight: 700
  },
  dropRow: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '14px',
    border: `1px dashed ${palette.border}`,
    background: palette.bgAlt,
    borderRadius: '10px'
  },
  label: {
    fontSize: '14px',
    color: palette.secondary,
    fontWeight: 600
  },
  fileInput: {
    padding: '10px',
    borderRadius: '8px',
    border: `1px solid ${palette.border}`,
    background: '#fff'
  },
  fileName: {
    fontSize: '12px',
    color: palette.textMuted
  },
  actionsRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
    flexWrap: 'wrap'
  },
  statusBox: {
    marginTop: '14px'
  },
  progressBarOuter: {
    height: '10px',
    width: '100%',
    borderRadius: '999px',
    background: '#eef1f5',
    overflow: 'hidden',
    border: `1px solid ${palette.border}`
  },
  progressBarInner: {
    height: '100%',
    width: '0%',
    background: `linear-gradient(90deg, ${palette.primary}, ${palette.accent})`,
    transition: 'width 0.4s ease'
  },
  statusMessage: {
    margin: '10px 0 0',
    color: palette.text
  },
  taskId: {
    margin: '4px 0 0',
    color: palette.textMuted,
    fontSize: '12px'
  },
  primaryBtn: {
    background: palette.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 6px 12px rgba(25,118,210,0.15)'
  },
  accentBtn: {
    background: palette.accent,
    color: '#222',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 6px 12px rgba(255,152,0,0.2)'
  },
  secondaryBtn: {
    background: '#fff',
    color: palette.secondary,
    border: `1px solid ${palette.secondary}`,
    borderRadius: '10px',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondaryBtnSmall: {
    background: '#fff',
    color: palette.secondary,
    border: `1px solid ${palette.secondary}`,
    borderRadius: '10px',
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '12px'
  },
  linkBtn: {
    background: 'transparent',
    color: palette.primary,
    border: `1px solid ${palette.primary}`,
    borderRadius: '10px',
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '12px'
  },
  disabledBtn: {
    opacity: 0.6,
    cursor: 'not-allowed',
    filter: 'grayscale(0.2)'
  },
  historyHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '6px'
  },
  historyList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '12px',
    border: `1px solid ${palette.border}`,
    borderRadius: '10px',
    background: palette.bgAlt
  },
  historyMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  historyTitle: {
    fontWeight: 700,
    color: palette.text
  },
  historySub: {
    fontSize: '12px',
    color: palette.textMuted
  },
  historyInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    border: `1px solid ${palette.border}`,
    color: palette.text
  },
  badgeSuccess: {
    background: '#e7f5ee',
    color: '#1b5e20',
    borderColor: '#b2dfbd'
  },
  badgeWarn: {
    background: '#fff3e0',
    color: '#ef6c00',
    borderColor: '#ffe0b2'
  },
  badgeDark: {
    background: '#eceff1',
    color: '#263238',
    borderColor: '#cfd8dc'
  },
  time: {
    fontSize: '12px',
    color: palette.textMuted
  },
  muted: {
    color: palette.textMuted
  },
  footer: {
    padding: '20px',
    borderTop: `1px solid ${palette.border}`,
    marginTop: '24px',
    textAlign: 'center',
    background: palette.bg
  },
  footerText: {
    color: palette.textMuted,
    fontSize: '12px'
  }
};

export default App;
