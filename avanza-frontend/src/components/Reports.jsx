import React, { useState, useEffect, useCallback } from 'react';
import './Reports.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// ── Icons ─────────────────────────────────────────────────

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);
const CalendarIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);
const EyeIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
);
const PhoneCallIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.69 19 19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 6.29 6.29l1.68-1.68a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);
const AlertIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);
const BarChartIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);
const FilterIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
);
const DocIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
);

// ── Helpers ───────────────────────────────────────────────
const toDateInput = (d) => d.toISOString().split('T')[0];

const getQuickRange = (key) => {
    const now = new Date();
    let from = new Date(now);
    switch (key) {
        case 'today': from = new Date(now.setHours(0, 0, 0, 0)); break;
        case 'this_week': from.setDate(now.getDate() - now.getDay()); break;
        case 'this_month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'last_month':
            from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return { from: toDateInput(from), to: toDateInput(new Date(now.getFullYear(), now.getMonth(), 0)) };
        default: break;
    }
    return { from: toDateInput(from), to: toDateInput(new Date()) };
};

const fmtDate = (iso) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
};

const SentimentBadge = ({ value }) => {
    const map = {
        Positive: { cls: 'badge badge--positive', label: 'Positive' },
        Negative: { cls: 'badge badge--negative', label: 'Negative' },
        Neutral: { cls: 'badge badge--neutral', label: 'Neutral' },
    };
    const b = map[value] || { cls: 'badge badge--neutral', label: value || '—' };
    return <span className={b.cls}>{b.label}</span>;
};

const ChurnBadge = ({ value }) => {
    if (!value) return <span className="badge badge--neutral">—</span>;
    const v = value.toLowerCase();
    const map = {
        low: 'badge badge--churn-low',
        medium: 'badge badge--churn-medium',
        high: 'badge badge--churn-high',
        critical: 'badge badge--churn-critical',
    };
    return <span className={map[v] || 'badge badge--neutral'}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>;
};

const QualityBar = ({ score }) => {
    const pct = score ? Math.min(100, Math.max(0, score)) : 0;
    const color = pct >= 75 ? 'var(--primary-purple)' : pct >= 50 ? '#F59E0B' : '#EF4444';
    return (
        <div className="quality-bar-wrap">
            <div className="quality-bar-track">
                <div className="quality-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="quality-bar-label">{pct}%</span>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────

export default function Reports({ onViewCall }) {
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();

    const [filters, setFilters] = useState({
        date_from: toDateInput(thirtyDaysAgo),
        date_to: toDateInput(today),
        sentiment: '',
        churn_risk: '',
        resolution: '',
        customer: '',
    });
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchReports = useCallback(async (f, p) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                date_from: f.date_from,
                date_to: f.date_to,
                sentiment: f.sentiment,
                churn_risk: f.churn_risk,
                resolution: f.resolution,
                customer: f.customer,
                page: p,
                limit: 10,
            });
            const res = await fetch(`${API_URL}/api/reports?${params}`);
            const json = await res.json();
            if (json.success) {
                setData(json);
            } else {
                setError(json.error || 'Failed to load reports');
            }
        } catch {
            setError('Could not connect to server. Make sure the backend is running.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReports(filters, page);
    }, []); // eslint-disable-line

    const handleSearch = () => { setPage(1); fetchReports(filters, 1); };
    const handleClear = () => {
        const reset = {
            date_from: toDateInput(thirtyDaysAgo),
            date_to: toDateInput(today),
            sentiment: '', churn_risk: '', resolution: '', customer: '',
        };
        setFilters(reset); setPage(1); fetchReports(reset, 1);
    };
    const handleQuick = (key) => {
        const range = getQuickRange(key);
        const updated = { ...filters, date_from: range.from, date_to: range.to };
        setFilters(updated); setPage(1); fetchReports(updated, 1);
    };
    const handlePageChange = (p) => { setPage(p); fetchReports(filters, p); };

    const stats = data?.stats || {};
    const calls = data?.calls || [];
    const pag = data?.pagination || {};

    return (
        <div className="reports-page">
            {/* ── Page Title ── */}
            <div className="reports-header">
                <h1 className="reports-title">Reports</h1>
                <p className="reports-subtitle">Search and filter all call reports</p>
            </div>

            {/* ── Filter Panel ── */}
            <div className="filter-card">
                {/* Row 1: Dates + Quick Select */}
                <div className="filter-row filter-row--top">
                    <div className="filter-group">
                        <label className="filter-label">Date Range</label>
                        <div className="date-range-wrap">
                            <div className="date-input-wrap">
                                <CalendarIcon />
                                <input
                                    type="date"
                                    className="filter-input"
                                    value={filters.date_from}
                                    onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                                />
                            </div>
                            <div className="date-input-wrap">
                                <CalendarIcon />
                                <input
                                    type="date"
                                    className="filter-input"
                                    value={filters.date_to}
                                    onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="filter-group">
                        <label className="filter-label">Quick Select</label>
                        <div className="quick-btns">
                            {[['today', 'Today'], ['this_week', 'This Week'], ['this_month', 'This Month'], ['last_month', 'Last Month']].map(([k, l]) => (
                                <button key={k} className="quick-btn" onClick={() => handleQuick(k)}>{l}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 2: Dropdowns + Customer Search */}
                <div className="filter-row filter-row--mid">
                    <div className="filter-group filter-group--small">
                        <label className="filter-label">Sentiment</label>
                        <select className="filter-select" value={filters.sentiment} onChange={e => setFilters(f => ({ ...f, sentiment: e.target.value }))}>
                            <option value="">All Sentiments</option>
                            <option value="Positive">Positive</option>
                            <option value="Negative">Negative</option>
                            <option value="Neutral">Neutral</option>
                        </select>
                    </div>
                    <div className="filter-group filter-group--grow">
                        <label className="filter-label">Customer Search</label>
                        <div className="customer-search-wrap">
                            <SearchIcon />
                            <input
                                type="text"
                                className="filter-input filter-input--search"
                                placeholder="Name, CNIC or phone"
                                value={filters.customer}
                                onChange={e => setFilters(f => ({ ...f, customer: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                    </div>
                </div>

                {/* Row 3: Churn + Resolution + Actions */}
                <div className="filter-row filter-row--bottom">
                    <div className="filter-group filter-group--small">
                        <label className="filter-label">Churn Risk</label>
                        <select className="filter-select" value={filters.churn_risk} onChange={e => setFilters(f => ({ ...f, churn_risk: e.target.value }))}>
                            <option value="">All Risk Levels</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>
                    <div className="filter-group filter-group--small">
                        <label className="filter-label">Resolution Status</label>
                        <select className="filter-select" value={filters.resolution} onChange={e => setFilters(f => ({ ...f, resolution: e.target.value }))}>
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="resolved">Resolved</option>
                            <option value="escalated">Escalated</option>
                        </select>
                    </div>
                    <div className="filter-actions">
                        <button className="btn-search" onClick={handleSearch} disabled={loading}>
                            <SearchIcon /> Search
                        </button>
                        <button className="btn-clear" onClick={handleClear}>✕ Clear</button>
                    </div>
                </div>
            </div>

            {/* ── Error ── */}
            {error && <div className="reports-error">{error}</div>}

            {/* ── Stats Row ── */}
            <div className="stats-row">
                {[
                    { label: 'Total Calls Found', value: loading ? '—' : stats.total_calls ?? '—', icon: <DocIcon />, color: '#B93775' },
                    { label: 'Negative Calls', value: loading ? '—' : stats.negative_calls ?? '—', icon: <AlertIcon />, color: '#EF4444' },
                    { label: 'Avg Quality Score', value: loading ? '—' : (stats.avg_quality_score ? `${stats.avg_quality_score}%` : '—'), icon: <BarChartIcon />, color: '#3B82F6' },
                    { label: 'High Churn Risk', value: loading ? '—' : stats.high_churn_risk ?? '—', icon: <FilterIcon />, color: '#F59E0B' },
                ].map(({ label, value, icon, color }) => (
                    <div className="stat-card" key={label}>
                        <div className="stat-card__body">
                            <div>
                                <div className="stat-card__label">{label}</div>
                                <div className="stat-card__value">{value}</div>
                            </div>
                            <div className="stat-card__icon" style={{ color }}>
                                {icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Table ── */}
            <div className="reports-table-card">
                {loading ? (
                    <div className="reports-loading">
                        <div className="reports-spinner" />
                        <span>Loading reports…</span>
                    </div>
                ) : calls.length === 0 ? (
                    <div className="reports-empty">
                        <PhoneCallIcon />
                        <p>No calls found for the selected filters.</p>
                    </div>
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="reports-table">
                                <thead>
                                    <tr>
                                        <th>DATE &amp; TIME</th>
                                        <th>CUSTOMER NAME</th>
                                        <th>SENTIMENT</th>
                                        <th>PRIMARY INTENT</th>
                                        <th>QUALITY SCORE</th>
                                        <th>CHURN RISK</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calls.map((call) => {
                                        const { date, time } = fmtDate(call.call_date);
                                        return (
                                            <tr key={call.call_id}>
                                                <td>
                                                    <div className="cell-date">{date}</div>
                                                    <div className="cell-time">{time}</div>
                                                </td>
                                                <td className="cell-name">{call.customer_name || '—'}</td>
                                                <td><SentimentBadge value={call.sentiment} /></td>
                                                <td className="cell-intent">{call.primary_intent || '—'}</td>
                                                <td><QualityBar score={call.quality_score} /></td>
                                                <td><ChurnBadge value={call.churn_risk} /></td>
                                                <td>
                                                    <button
                                                        className="btn-view"
                                                        onClick={() => onViewCall && onViewCall(call.call_id)}
                                                    >
                                                        <EyeIcon /> View
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Pagination ── */}
                        <div className="pagination-bar">
                            <span className="pagination-info">
                                Showing {((pag.page - 1) * pag.limit) + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total} results
                            </span>
                            <div className="pagination-btns">
                                <button
                                    className="pag-btn pag-btn--arrow"
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page <= 1}
                                >&lt;</button>
                                {Array.from({ length: pag.total_pages || 1 }, (_, i) => i + 1)
                                    .filter(p => Math.abs(p - page) <= 2)
                                    .map(p => (
                                        <button
                                            key={p}
                                            className={`pag-btn${p === page ? ' pag-btn--active' : ''}`}
                                            onClick={() => handlePageChange(p)}
                                        >{p}</button>
                                    ))}
                                <button
                                    className="pag-btn pag-btn--arrow"
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page >= (pag.total_pages || 1)}
                                >&gt;</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
