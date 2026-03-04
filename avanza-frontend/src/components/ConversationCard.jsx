import React, { useState } from 'react';
import { MessageSquare, User, Headphones, ChevronDown, ChevronUp, FileText } from 'lucide-react';

const ConversationCard = ({ transcription, diarizedConversation }) => {
    const [showRaw, setShowRaw] = useState(false);

    // Normalize diarized data
    let turns = null;
    if (diarizedConversation) {
        if (typeof diarizedConversation === 'string') {
            try { turns = JSON.parse(diarizedConversation); } catch { turns = null; }
        } else if (Array.isArray(diarizedConversation)) {
            turns = diarizedConversation;
        }
    }

    const hasTurns = turns && turns.length > 0;

    // Stats
    const agentCount = hasTurns ? turns.filter(t => t.speaker === 'Agent').length : 0;
    const customerCount = hasTurns ? turns.filter(t => t.speaker === 'Customer').length : 0;

    return (
        <div className="card conversation-card">
            <div className="card-header">
                <MessageSquare size={18} />
                <h3>Conversation</h3>
                {hasTurns && (
                    <div className="conversation-badges">
                        <span className="conv-badge agent-badge">
                            <Headphones size={12} /> Agent: {agentCount}
                        </span>
                        <span className="conv-badge customer-badge">
                            <User size={12} /> Customer: {customerCount}
                        </span>
                    </div>
                )}
            </div>

            <div className="card-content">
                {hasTurns ? (
                    <>
                        <div className="chat-thread">
                            {turns.map((turn, idx) => {
                                const isAgent = turn.speaker === 'Agent';
                                return (
                                    <div
                                        key={idx}
                                        className={`chat-message-row ${isAgent ? 'agent-row' : 'customer-row'}`}
                                    >
                                        {isAgent && (
                                            <div className="chat-avatar agent-avatar" title="Agent">
                                                <Headphones size={14} />
                                            </div>
                                        )}
                                        <div className={`chat-bubble ${isAgent ? 'agent-bubble' : 'customer-bubble'}`}>
                                            <div className="bubble-speaker-label">{isAgent ? 'Agent' : 'Customer'}</div>
                                            <p className="bubble-text">{turn.text}</p>
                                            <div className="bubble-turn-num">#{idx + 1}</div>
                                        </div>
                                        {!isAgent && (
                                            <div className="chat-avatar customer-avatar" title="Customer">
                                                <User size={14} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Toggle raw text */}
                        {transcription && (
                            <button
                                className="raw-toggle-btn"
                                onClick={() => setShowRaw(!showRaw)}
                            >
                                <FileText size={13} />
                                {showRaw ? 'Hide' : 'Show'} Raw Transcription
                                {showRaw ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                        )}
                        {showRaw && transcription && (
                            <div className="raw-transcription-box">
                                <p>{transcription}</p>
                            </div>
                        )}
                    </>
                ) : transcription ? (
                    /* Fallback: no diarized data yet, show plain text */
                    <div className="transcription-pending">
                        <div className="pending-icon">
                            <MessageSquare size={32} />
                        </div>
                        <p className="pending-title">Transcription Available</p>
                        <p className="pending-sub">Speaker separation is being processed or unavailable.</p>
                        <div className="raw-transcription-box" style={{ marginTop: '12px' }}>
                            <p>{transcription}</p>
                        </div>
                    </div>
                ) : (
                    <div className="conversation-empty">
                        <div className="empty-chat-icon">
                            <MessageSquare size={36} />
                        </div>
                        <p>Upload a call recording to see the conversation here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConversationCard;
