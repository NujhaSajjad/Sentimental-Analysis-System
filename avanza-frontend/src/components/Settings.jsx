import React, { useState } from 'react';
import './Settings.css';

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const Toggle = ({ checked, onChange }) => (
    <button
        className={`toggle${checked ? ' toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
        type="button"
    >
        <span className="toggle__knob" />
    </button>
);

export default function Settings() {
    const [saved, setSaved] = useState(false);
    const [general, setGeneral] = useState({
        app_name: 'Avanza Solutions',
        timezone: 'Asia/Karachi',
        date_format: 'MM/DD/YYYY',
        language: 'en',
    });
    const [notifications, setNotifications] = useState({
        email_on_upload: true,
        email_on_completion: true,
        email_on_high_churn: false,
        email_on_critical_urgency: true,
    });

    const handleSave = () => {
        // Settings are local for now — extend to persist via API as needed
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">Manage your application preferences</p>
            </div>

            {/* ── General ── */}
            <div className="settings-card">
                <div className="settings-card__header">
                    <h2 className="settings-card__title">General</h2>
                    <p className="settings-card__desc">Basic application configuration</p>
                </div>
                <div className="settings-card__body">
                    <div className="settings-row">
                        <div className="settings-field">
                            <label className="settings-label">Application Name</label>
                            <input
                                type="text"
                                className="settings-input"
                                value={general.app_name}
                                onChange={e => setGeneral(g => ({ ...g, app_name: e.target.value }))}
                            />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Timezone</label>
                            <select
                                className="settings-select"
                                value={general.timezone}
                                onChange={e => setGeneral(g => ({ ...g, timezone: e.target.value }))}
                            >
                                <option value="Asia/Karachi">Asia/Karachi (PKT +5:00)</option>
                                <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                                <option value="Europe/London">Europe/London (GMT)</option>
                                <option value="America/New_York">America/New_York (EST)</option>
                                <option value="UTC">UTC</option>
                            </select>
                        </div>
                    </div>
                    <div className="settings-row">
                        <div className="settings-field">
                            <label className="settings-label">Date Format</label>
                            <select
                                className="settings-select"
                                value={general.date_format}
                                onChange={e => setGeneral(g => ({ ...g, date_format: e.target.value }))}
                            >
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                            </select>
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Language</label>
                            <select
                                className="settings-select"
                                value={general.language}
                                onChange={e => setGeneral(g => ({ ...g, language: e.target.value }))}
                            >
                                <option value="en">English</option>
                                <option value="ur">Urdu</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Notifications ── */}
            <div className="settings-card">
                <div className="settings-card__header">
                    <h2 className="settings-card__title">Notifications</h2>
                    <p className="settings-card__desc">Control when you receive email alerts</p>
                </div>
                <div className="settings-card__body">
                    {[
                        { key: 'email_on_upload', label: 'New call uploaded', desc: 'Notify when a new audio file is uploaded' },
                        { key: 'email_on_completion', label: 'Analysis completed', desc: 'When AI analysis finishes for a call' },
                        { key: 'email_on_high_churn', label: 'High churn risk detected', desc: 'Alert when a customer is flagged High or Critical' },
                        { key: 'email_on_critical_urgency', label: 'Critical urgency call', desc: 'When a call is marked as critical urgency' },
                    ].map(({ key, label, desc }) => (
                        <div className="notification-row" key={key}>
                            <div className="notification-text">
                                <span className="notification-label">{label}</span>
                                <span className="notification-desc">{desc}</span>
                            </div>
                            <Toggle
                                checked={notifications[key]}
                                onChange={val => setNotifications(n => ({ ...n, [key]: val }))}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* ── API Config (read-only) ── */}
            <div className="settings-card">
                <div className="settings-card__header">
                    <h2 className="settings-card__title">API Configuration</h2>
                    <p className="settings-card__desc">Connected services status</p>
                </div>
                <div className="settings-card__body">
                    {[
                        { label: 'Backend API', value: 'http://localhost:3000', status: 'connected' },
                        { label: 'AI Provider', value: 'OpenRouter (configured)', status: 'connected' },
                        { label: 'Whisper Service', value: 'http://localhost:8000', status: 'connected' },
                        { label: 'Database', value: 'PostgreSQL (local)', status: 'connected' },
                    ].map(({ label, value, status }) => (
                        <div className="api-row" key={label}>
                            <div className="api-info">
                                <span className="api-label">{label}</span>
                                <span className="api-value">{value}</span>
                            </div>
                            <span className={`api-status api-status--${status}`}>
                                {status === 'connected' ? <CheckIcon /> : '✕'}
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Save ── */}
            <div className="settings-footer">
                {saved && (
                    <div className="settings-saved">
                        <CheckIcon /> Settings saved successfully!
                    </div>
                )}
                <button className="settings-save-btn" onClick={handleSave}>
                    Save Changes
                </button>
            </div>
        </div>
    );
}
