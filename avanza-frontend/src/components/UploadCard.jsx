// UploadCard.jsx
// Single-button card → modal with:
//   1. Live customer search (debounced, from DB)
//   2. File drag-and-drop
//   3. Upload + AI pipeline on submit
//
// Props:
//   onSubmit(file, customer, callId) — called after pipeline finishes
//   uploadStatus  — bool (shows success state on card)
//   fileInfo      — string (shown in success state)

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, CloudUpload, Search, User, Phone, CreditCard,
  X, CheckCircle, FileAudio, ChevronRight, AlertCircle,
  Loader
} from 'lucide-react';
import { searchCustomers, uploadAudio, processCall } from '../api';

// ── helpers ──────────────────────────────────────────────
const fmt = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
};

// ── scoped styles ─────────────────────────────────────────
const css = `
  @keyframes uc-fadeIn  { from { opacity:0 }                             to { opacity:1 } }
  @keyframes uc-slideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
  @keyframes uc-spin    { to   { transform:rotate(360deg) } }

  .uc-trigger {
    width:100%; padding:13px 20px;
    background:linear-gradient(135deg,var(--primary-purple),var(--primary-pink));
    color:#fff; border:none; border-radius:12px;
    font-size:14px; font-weight:600; font-family:'Inter',sans-serif;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
    transition:transform .22s, box-shadow .22s;
  }
  .uc-trigger:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(185,55,117,.35); }

  .uc-backdrop {
    position:fixed; inset:0; background:rgba(15,10,30,.55);
    backdrop-filter:blur(4px); z-index:1200;
    display:flex; align-items:center; justify-content:center; padding:20px;
    animation:uc-fadeIn .18s ease;
  }
  .uc-modal {
    background:#fff; border-radius:20px;
    width:100%; max-width:520px; max-height:92vh; overflow-y:auto;
    box-shadow:0 24px 64px rgba(0,0,0,.22);
    animation:uc-slideUp .22s ease;
  }

  /* header */
  .uc-header {
    padding:20px 24px 18px;
    background:linear-gradient(135deg,var(--primary-purple),var(--primary-pink));
    display:flex; align-items:center; justify-content:space-between;
    position:sticky; top:0; z-index:10;
  }
  .uc-header-title { color:#fff; font-size:16px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px; }
  .uc-close {
    background:rgba(255,255,255,.2); border:none; border-radius:8px;
    width:32px; height:32px; display:flex; align-items:center; justify-content:center;
    cursor:pointer; color:#fff; transition:background .18s;
  }
  .uc-close:hover { background:rgba(255,255,255,.35); }

  /* steps */
  .uc-steps { display:flex; align-items:center; gap:6px; padding:14px 24px; border-bottom:1px solid var(--border); }
  .uc-step        { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-light); font-weight:400; }
  .uc-step.active { color:var(--primary-purple); font-weight:600; }
  .uc-step.done   { color:var(--success); font-weight:600; }
  .uc-dot {
    width:22px; height:22px; border-radius:50%; font-size:11px; font-weight:700;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    background:var(--border); color:var(--text-light); transition:all .22s;
  }
  .uc-step.active .uc-dot { background:var(--primary-purple); color:#fff; }
  .uc-step.done   .uc-dot { background:var(--success); color:#fff; }
  .uc-step-arrow  { color:var(--border); flex-shrink:0; }

  /* body */
  .uc-body { padding:20px 24px; }
  .uc-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--text-light); margin-bottom:10px; }

  /* search */
  .uc-search-wrap { position:relative; margin-bottom:8px; }
  .uc-search-input {
    width:100%; padding:11px 40px 11px 38px;
    border:1.5px solid var(--border); border-radius:10px;
    font-size:14px; font-family:'Inter',sans-serif;
    color:var(--text-dark); background:#FAFAFA; outline:none; transition:border-color .18s;
  }
  .uc-search-input:focus { border-color:var(--primary-purple); }
  .uc-search-input::placeholder { color:var(--text-light); }
  .uc-search-icon { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--text-light); pointer-events:none; }
  .uc-spin-sm {
    width:16px; height:16px; border:2px solid var(--border); border-top-color:var(--primary-purple);
    border-radius:50%; animation:uc-spin .7s linear infinite; flex-shrink:0;
  }
  .uc-spin-abs { position:absolute; right:11px; top:50%; transform:translateY(-50%); }

  /* results */
  .uc-results { max-height:190px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; margin-bottom:4px; }
  .uc-result-item {
    display:flex; align-items:center; gap:12px; padding:10px 14px;
    cursor:pointer; transition:background .15s; border-bottom:1px solid var(--border);
  }
  .uc-result-item:last-child { border-bottom:none; }
  .uc-result-item:hover { background:#F9FAFB; }
  .uc-r-avatar {
    width:36px; height:36px; border-radius:10px; flex-shrink:0;
    background:linear-gradient(135deg,#F3F4FF,#EDF0FF);
    display:flex; align-items:center; justify-content:center; color:var(--primary-purple);
  }
  .uc-r-name { font-size:14px; font-weight:600; color:var(--text-dark); margin-bottom:2px; }
  .uc-r-meta { display:flex; gap:10px; }
  .uc-r-chip { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-gray); }
  .uc-no-results { text-align:center; padding:14px; font-size:13px; color:var(--text-light); border:1px solid var(--border); border-radius:10px; margin-bottom:4px; }

  /* selected pill */
  .uc-selected { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#F0FDF4; border:1.5px solid #BBF7D0; border-radius:10px; margin-bottom:4px; }
  .uc-sel-avatar { width:32px; height:32px; border-radius:8px; flex-shrink:0; background:linear-gradient(135deg,#10B981,#059669); display:flex; align-items:center; justify-content:center; color:#fff; }
  .uc-sel-name { font-size:14px; font-weight:600; color:#065F46; }
  .uc-sel-sub  { font-size:11px; color:#059669; }
  .uc-sel-change { margin-left:auto; font-size:11px; color:var(--text-gray); cursor:pointer; background:none; border:none; text-decoration:underline; font-family:'Inter',sans-serif; }

  /* divider */
  .uc-divider { display:flex; align-items:center; gap:12px; margin:18px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-light); }
  .uc-divider-line { flex:1; height:1px; background:var(--border); }

  /* dropzone */
  .uc-dropzone { border:2px dashed var(--border); border-radius:12px; padding:28px 20px; text-align:center; cursor:pointer; background:#FAFAFA; transition:all .2s ease; }
  .uc-dropzone.active { border-color:var(--primary-purple); background:#FAF5FF; }
  .uc-drop-icon { color:var(--text-light); margin-bottom:10px; }
  .uc-drop-text { font-size:14px; font-weight:500; color:var(--text-dark); margin-bottom:4px; }
  .uc-drop-sub  { font-size:12px; color:var(--text-gray); margin-bottom:10px; }
  .uc-browse    { color:var(--primary-purple); font-weight:600; cursor:pointer; }
  .uc-drop-hint { display:inline-block; font-size:11px; color:var(--text-light); background:var(--border); padding:4px 10px; border-radius:6px; }

  /* file pill */
  .uc-file { display:flex; align-items:center; gap:12px; padding:12px 14px; background:#F3F4FF; border:1.5px solid #C7D2FE; border-radius:10px; }
  .uc-file-icon { width:36px; height:36px; border-radius:8px; flex-shrink:0; background:linear-gradient(135deg,var(--primary-purple),var(--primary-pink)); display:flex; align-items:center; justify-content:center; color:#fff; }
  .uc-file-name { font-size:13px; font-weight:600; color:var(--text-dark); margin-bottom:2px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .uc-file-size { font-size:11px; color:var(--text-gray); }
  .uc-file-rm { margin-left:auto; width:26px; height:26px; border-radius:6px; border:none; background:#E0E7FF; color:var(--primary-purple); cursor:pointer; display:flex; align-items:center; justify-content:center; }

  /* progress */
  .uc-progress-wrap { margin-top:14px; }
  .uc-progress-label { font-size:12px; color:var(--text-gray); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .uc-progress-track { height:6px; background:var(--border); border-radius:3px; overflow:hidden; }
  .uc-progress-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--primary-purple),var(--primary-pink)); transition:width .3s ease; }
  .uc-indeterminate { animation:uc-indeterminate 1.4s ease infinite; }
  @keyframes uc-indeterminate {
    0%   { width:0%;   margin-left:0; }
    50%  { width:60%;  margin-left:20%; }
    100% { width:0%;   margin-left:100%; }
  }

  /* error */
  .uc-error { display:flex; align-items:center; gap:8px; margin-top:12px; padding:10px 14px; background:#FEE2E2; border-radius:8px; font-size:13px; color:#DC2626; }

  /* footer */
  .uc-footer { padding:16px 24px; border-top:1px solid var(--border); display:flex; gap:10px; position:sticky; bottom:0; background:#fff; }
  .uc-cancel { padding:11px 20px; border-radius:10px; border:1.5px solid var(--border); background:#fff; color:var(--text-gray); font-size:14px; font-weight:500; cursor:pointer; font-family:'Inter',sans-serif; transition:background .18s; }
  .uc-cancel:hover { background:var(--background); }
  .uc-submit { flex:1; padding:11px 20px; border-radius:10px; border:none; font-size:14px; font-weight:600; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:8px; transition:all .22s; cursor:pointer; }
  .uc-submit.ready { background:linear-gradient(135deg,var(--primary-purple),var(--primary-pink)); color:#fff; }
  .uc-submit.ready:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(185,55,117,.3); }
  .uc-submit:disabled { background:var(--border); color:var(--text-light); cursor:not-allowed; transform:none !important; box-shadow:none !important; }
  .uc-spin-btn { animation:uc-spin .8s linear infinite; }
`;

// ─────────────────────────────────────────────────────────
const UploadCard = ({ onSubmit, uploadStatus, fileInfo }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [file, setFile] = useState(null);
  // stage: null | 'uploading' | 'processing' | 'done'
  const [stage, setStage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const debounceRef = useRef(null);
  const busy = !!stage && stage !== 'done';

  // ── live customer search ──────────────────────────────
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchCustomers(query);
        setResults(data.customers || []);
        setShowResults(true);
      } catch {
        setResults([]);
        setShowResults(false);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const pickCustomer = (c) => {
    setSelectedCustomer(c);
    setShowResults(false);
    setQuery('');
    setResults([]);
  };

  // ── dropzone ─────────────────────────────────────────
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected?.length) {
      setError(rejected[0]?.errors[0]?.message || 'File rejected. Check type and size.');
      return;
    }
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    disabled: busy,
  });

  // ── submit: upload → AI pipeline ─────────────────────
  const handleSubmit = async () => {
    if (!file || busy) return;
    setError('');

    try {
      // ── 1. Upload ──
      setStage('uploading');
      setProgress(0);

      const uploadData = await uploadAudio(
        file,
        selectedCustomer,
        (pct) => setProgress(pct)
      );

      if (!uploadData?.success) {
        throw new Error(uploadData?.error || 'Upload failed');
      }
      const callId = uploadData.callId;

      // ── 2. AI pipeline ──
      setStage('processing');
      setProgress(0);

      const processData = await processCall(callId);
      if (!processData?.success) {
        throw new Error(processData?.error || 'Processing failed');
      }

      // ── 3. Notify parent, close ──
      setStage('done');
      onSubmit?.(file, selectedCustomer, callId);
      closeModal();

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStage(null);
    }
  };

  // ── modal reset / close ───────────────────────────────
  const closeModal = () => {
    if (busy) return;
    setOpen(false);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSelectedCustomer(null);
    setFile(null);
    setStage(null);
    setProgress(0);
    setError('');
  };

  const canSubmit = !!file && !busy;
  const stepCustomer = selectedCustomer ? 'done' : 'active';
  const stepFile = file ? 'done' : selectedCustomer ? 'active' : '';
  const stepAnalyse = stage === 'done' ? 'done' : stage ? 'active' : '';

  const stageLabel = stage === 'uploading' ? 'Uploading audio…'
    : stage === 'processing' ? 'Running AI pipeline…'
      : '';

  return (
    <>
      <style>{css}</style>

      {/* ── Card ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <Upload size={18} />
          <h3>Upload Audio File</h3>
        </div>
        <div className="card-content">
          {uploadStatus ? (
            <div className="upload-status">
              <div className="status-message">
                <CheckCircle size={20} />
                <span>File uploaded successfully!</span>
              </div>
              {fileInfo && <div className="file-info">{fileInfo}</div>}
            </div>
          ) : (
            <button className="uc-trigger" onClick={() => setOpen(true)}>
              <CloudUpload size={16} />
              Upload Audio File
            </button>
          )}
        </div>
      </div>

      {/* ── Modal ────────────────────────────────────── */}
      {open && (
        <div
          className="uc-backdrop"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="uc-modal">

            {/* Header */}
            <div className="uc-header">
              <h2 className="uc-header-title">
                <CloudUpload size={17} />
                New Audio Upload
              </h2>
              <button className="uc-close" onClick={closeModal} disabled={busy}>
                <X size={15} />
              </button>
            </div>

            {/* Steps */}
            <div className="uc-steps">
              <div className={`uc-step ${stepCustomer}`}>
                <div className="uc-dot">
                  {selectedCustomer ? <CheckCircle size={11} /> : '1'}
                </div>
                Customer
              </div>
              <ChevronRight size={13} className="uc-step-arrow" />
              <div className={`uc-step ${stepFile}`}>
                <div className="uc-dot">
                  {file ? <CheckCircle size={11} /> : '2'}
                </div>
                Attach File
              </div>
              <ChevronRight size={13} className="uc-step-arrow" />
              <div className={`uc-step ${stepAnalyse}`}>
                <div className="uc-dot">
                  {stage === 'done'
                    ? <CheckCircle size={11} />
                    : stage
                      ? <Loader size={11} className="uc-spin-btn" />
                      : '3'}
                </div>
                Analyse
              </div>
            </div>

            {/* Body */}
            <div className="uc-body">

              {/* Step 1 — Customer */}
              <p className="uc-label">
                Search Customer{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </p>

              {selectedCustomer ? (
                <div className="uc-selected">
                  <div className="uc-sel-avatar"><User size={15} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="uc-sel-name">{selectedCustomer.full_name}</div>
                    <div className="uc-sel-sub">
                      {selectedCustomer.phone_number}
                      {selectedCustomer.cnic ? ` · ${selectedCustomer.cnic}` : ''}
                    </div>
                  </div>
                  {!busy && (
                    <button className="uc-sel-change" onClick={() => setSelectedCustomer(null)}>
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="uc-search-wrap">
                    <Search size={15} className="uc-search-icon" />
                    <input
                      className="uc-search-input"
                      placeholder="Name, CNIC, or phone number…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={busy}
                    />
                    {searching && (
                      <div className="uc-spin-sm uc-spin-abs" />
                    )}
                  </div>

                  {showResults && results.length > 0 && (
                    <div className="uc-results">
                      {results.map((c) => (
                        <div
                          key={c.customer_id}
                          className="uc-result-item"
                          onClick={() => pickCustomer(c)}
                        >
                          <div className="uc-r-avatar"><User size={15} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="uc-r-name">{c.full_name || 'Unknown'}</div>
                            <div className="uc-r-meta">
                              {c.cnic && (
                                <span className="uc-r-chip">
                                  <CreditCard size={11} />{c.cnic}
                                </span>
                              )}
                              {c.phone_number && (
                                <span className="uc-r-chip">
                                  <Phone size={11} />{c.phone_number}
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-light)', flexShrink: 0 }}>
                            {c.total_calls ?? 0} calls
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {showResults && results.length === 0 && !searching && (
                    <div className="uc-no-results">No customers found for "{query}"</div>
                  )}
                </>
              )}

              {/* Divider */}
              <div className="uc-divider">
                <div className="uc-divider-line" />
                Attach Audio
                <div className="uc-divider-line" />
              </div>

              {/* Step 2 — File */}
              {file ? (
                <div className="uc-file">
                  <div className="uc-file-icon"><FileAudio size={17} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="uc-file-name">{file.name}</div>
                    <div className="uc-file-size">{fmt(file.size)}</div>
                  </div>
                  {!busy && (
                    <button className="uc-file-rm" onClick={() => setFile(null)}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`uc-dropzone${isDragActive ? ' active' : ''}`}
                >
                  <input {...getInputProps()} />
                  <div className="uc-drop-icon"><CloudUpload size={40} /></div>
                  <p className="uc-drop-text">Drag & drop your audio file</p>
                  <p className="uc-drop-sub">
                    or <span className="uc-browse">browse files</span>
                  </p>
                  <span className="uc-drop-hint">MP3 · WAV · M4A · OGG · Max 50 MB</span>
                </div>
              )}

              {/* Progress bar while busy */}
              {busy && (
                <div className="uc-progress-wrap">
                  <div className="uc-progress-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="uc-spin-sm" />
                      {stageLabel}
                    </span>
                    {stage === 'uploading' && <span>{progress}%</span>}
                  </div>
                  <div className="uc-progress-track">
                    {stage === 'uploading' ? (
                      <div
                        className="uc-progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    ) : (
                      <div
                        className="uc-progress-fill uc-indeterminate"
                        style={{ width: '60%' }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="uc-error">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="uc-footer">
              <button className="uc-cancel" onClick={closeModal} disabled={busy}>
                Cancel
              </button>
              <button
                className={`uc-submit ${canSubmit ? 'ready' : ''}`}
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {busy ? (
                  <>
                    <Loader size={14} className="uc-spin-btn" />
                    {stageLabel}
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    {selectedCustomer
                      ? `Upload for ${selectedCustomer.full_name.split(' ')[0]}`
                      : 'Upload & Analyse'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UploadCard;