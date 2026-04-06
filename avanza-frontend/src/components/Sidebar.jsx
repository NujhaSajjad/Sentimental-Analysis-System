import React, { useState } from 'react';
import './Sidebar.css';

const PhoneIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 6.29 6.29l1.68-1.68a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const DashboardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);

const ReportsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41" />
    </svg>
);

const LogoutIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

const ChevronIcon = ({ collapsed }) => (
    <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
    >
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { id: 'reports', label: 'Reports', icon: ReportsIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ activePage, onNavigate, onLogout }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
            {/* Header / Logo */}
            <div className="sidebar__header">
                <div className="sidebar__logo">
                    <div className="sidebar__logo-icon">
                        <PhoneIcon />
                    </div>
                    {!collapsed && (
                        <div className="sidebar__logo-text">
                            <span className="sidebar__logo-name">Avanza Solutions</span>
                            <span className="sidebar__logo-sub">AI Call Analytics</span>
                        </div>
                    )}
                </div>
                <button
                    className="sidebar__toggle"
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <ChevronIcon collapsed={collapsed} />
                </button>
            </div>

            {/* Divider */}
            <div className="sidebar__divider" />

            {/* Navigation */}
            <nav className="sidebar__nav">
                {navItems.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        className={`sidebar__nav-item${activePage === id ? ' sidebar__nav-item--active' : ''}`}
                        onClick={() => onNavigate(id)}
                        title={collapsed ? label : ''}
                    >
                        <span className="sidebar__nav-icon"><Icon /></span>
                        {!collapsed && <span className="sidebar__nav-label">{label}</span>}
                    </button>
                ))}
            </nav>

            {/* Spacer + Logout */}
            <div className="sidebar__footer">
                <div className="sidebar__divider sidebar__divider--footer" />
                <button
                    className="sidebar__logout"
                    onClick={onLogout}
                    title={collapsed ? 'Logout' : ''}
                >
                    <span className="sidebar__nav-icon sidebar__logout-icon"><LogoutIcon /></span>
                    {!collapsed && <span className="sidebar__nav-label">Logout</span>}
                </button>
            </div>
        </aside>
    );
}
