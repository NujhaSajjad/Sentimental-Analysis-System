import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const Login = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('admin@gmail.com');
    const [password, setPassword] = useState('admin');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/api/login`, { email, password });
            if (response.data.success) {
                onLoginSuccess(response.data.user);
            } else {
                setError(response.data.error || 'Login failed');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-header-wrapper">
                <div className="login-logo-container">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 16.92V20C22 20.5523 21.5523 21 21 21C10.5066 21 2 12.4934 2 2C2 1.44772 2.44772 1 3 1H6.08C6.58254 1 7.00972 1.37123 7.07222 1.8711C7.14725 2.47146 7.28892 3.05753 7.49372 3.61805C7.65342 4.05523 7.5501 4.54784 7.22 4.88L5.94 6.16C7.38209 8.69468 9.42532 10.7379 11.96 12.18L13.24 10.9C13.5722 10.5699 14.0648 10.4666 14.5019 10.6263C15.0625 10.8311 15.6485 10.9728 16.2489 11.0478C16.7488 11.1103 17.12 11.5375 17.12 12.04V15.12C17.12 15.6723 16.6723 16.12 16.12 16.12H15C15 16.12 15 16.12 15 16.12Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <h1 className="login-company-name">Avanza Solutions</h1>
                <p className="login-company-subtitle">AI Call Analytics Platform</p>
            </div>

            <div className="login-card">
                <h2 className="login-title">Welcome Back</h2>
                <p className="login-subtitle">Sign in to access your dashboard</p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>Email Address</label>
                        <div className="input-wrapper">
                            <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="input-wrapper">
                            <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {showPassword ? (
                                        <>
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                            <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </>
                                    ) : (
                                        <>
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </>
                                    )}
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="forgot-password">
                        <a href="#forgot" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>

            <div className="login-footer">
                <p>© 2024 Avanza Solutions. All rights reserved.</p>
                <div className="login-footer-links">
                    <a href="#privacy">Privacy Policy</a>
                    <span className="dot">•</span>
                    <a href="#terms">Terms of Service</a>
                    <span className="dot">•</span>
                    <a href="#help">Help Center</a>
                </div>
            </div>

            <button className="help-button" aria-label="Help">
                ?
            </button>
        </div>
    );
};

export default Login;
