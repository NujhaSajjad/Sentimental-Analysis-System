

import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import './components/NewComponents.css';

import Header from './components/Header';
import UploadCard from './components/UploadCard';
import ConversationCard from './components/ConversationCard';
import IntentCard from './components/IntentCard';
import MetricsRow from './components/MetricsRow';
import AnalysisCard from './components/AnalysisCard';
import ActionItemsCard from './components/ActionItemsCard';
import BottomActions from './components/BottomActions';
import LoadingOverlay from './components/LoadingOverlay';
import Login from './components/Login';

// New components
import CustomerSearch from './components/CustomerSearch';
import CustomerProfile from './components/CustomerProfile';
import CallHistory from './components/CallHistory';
import SentimentTimeline from './components/SentimentTimeline';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function App() {
  // State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(false);
  const [fileInfo, setFileInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [currentCallId, setCurrentCallId] = useState(null);

  // Report data
  const [transcription, setTranscription] = useState('');
  const [diarizedConversation, setDiarizedConversation] = useState(null);
  const [intent, setIntent] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [actionItems, setActionItems] = useState([]);

  // Metrics
  const [duration, setDuration] = useState('00:00');
  const [sentiment, setSentiment] = useState('0%');
  const [intentType, setIntentType] = useState('-');
  const [priority, setPriority] = useState('-');

  // New state for customer features
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [callHistoryCustomerId, setCallHistoryCustomerId] = useState(null);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Handle customer selection from search
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerProfile(true);
  };

  // Handle view calls from customer profile
  const handleViewCalls = (customerId) => {
    setCallHistoryCustomerId(customerId);
    setShowCustomerProfile(false);
    setShowCallHistory(true);
  };

  // Handle call selection from history
  const handleCallSelect = async (callId) => {
    try {
      setLoading(true);
      setLoadingMessage('Loading call details...');
      setShowCallHistory(false);

      const response = await axios.get(`${API_URL}/api/calls/${callId}`);

      if (response.data.success) {
        displayCallReport(response.data.call);
        setCurrentCallId(callId);
      }
    } catch (error) {
      console.error('Failed to load call:', error);
      alert('Failed to load call details');
    } finally {
      setLoading(false);
    }
  };

  // Display call report from database
  const displayCallReport = (call) => {
    // Set transcription
    if (call.transcription_text) {
      setTranscription(call.transcription_text);
    }

    // Set diarized conversation (chat bubbles)
    if (call.diarized_conversation) {
      const diarized = typeof call.diarized_conversation === 'string'
        ? JSON.parse(call.diarized_conversation)
        : call.diarized_conversation;
      setDiarizedConversation(diarized);
    } else {
      setDiarizedConversation(null);
    }

    // Set duration
    if (call.call_duration) {
      const mins = Math.floor(call.call_duration / 60);
      const secs = call.call_duration % 60;
      setDuration(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }

    // Set intent
    if (call.intent_data) {
      const intentData = typeof call.intent_data === 'string' ?
        JSON.parse(call.intent_data) : call.intent_data;
      setIntent(intentData);
      if (intentData.primary_intent) {
        setIntentType(intentData.primary_intent);
      }
    } else if (call.primary_intent) {
      setIntentType(call.primary_intent);
      setIntent({
        primary_intent: call.primary_intent,
        sentiment: call.sentiment,
        urgency: call.urgency
      });
    }

    // Set sentiment
    if (call.sentiment) {
      setSentiment(call.sentiment);
      if (call.sentiment_score) {
        const percentage = Math.round(((call.sentiment_score + 100) / 200) * 100);
        setSentiment(`${percentage}%`);
      }
    }

    // Set priority/urgency
    if (call.urgency) {
      setPriority(call.urgency);
    }

    // Set analysis
    if (call.ai_analysis) {
      setAnalysis(call.ai_analysis);
    }

    // Set action items
    const actions = [];
    if (call.agent_approach_do && Array.isArray(call.agent_approach_do)) {
      actions.push(...call.agent_approach_do.map(item => `✓ ${item}`));
    }
    if (call.agent_approach_avoid && Array.isArray(call.agent_approach_avoid)) {
      actions.push(...call.agent_approach_avoid.map(item => `✗ ${item}`));
    }
    if (actions.length > 0) {
      setActionItems(actions);
    }

    setUploadStatus(true);
    setFileInfo(call.audio_filename || 'Call loaded from database');
  };

  // Poll for the call report until transcription_text is present (max 10 attempts, 2s apart).
  // Needed because the AI pipeline saves to DB asynchronously, and we might fetch
  // the report before the write has landed.
  const pollCallReport = async (callId, maxAttempts = 10, delayMs = 2000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await axios.get(`${API_URL}/api/calls/${callId}`);
      const call = response.data?.call;
      if (call && call.transcription_text) {
        return call; // data is ready
      }
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    // Return whatever we have even if transcription isn't ready yet
    const finalResponse = await axios.get(`${API_URL}/api/calls/${callId}`);
    return finalResponse.data?.call || null;
  };

  // Handle successful upload and processing from the new UploadCard modal
  const handleUploadSubmit = async (file, customer, callId) => {
    try {
      setLoading(true);
      setLoadingMessage('Finalizing report...');

      // Update selected customer if one was chosen in the modal
      if (customer) {
        setSelectedCustomer(customer);
      }

      // Poll until the DB has the transcription + analysis (handles async save race condition)
      setLoadingMessage('Loading analysis results...');
      const call = await pollCallReport(callId);
      if (call) {
        displayCallReport(call);
        setUploadStatus(true);
        setFileInfo(`${file.name} (${formatFileSize(file.size)})`);
      } else {
        throw new Error('Could not retrieve call report from server.');
      }
    } catch (error) {
      console.error('Error in upload submit flow:', error);
      alert('Failed to display the processed report. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset all data
  const resetAll = () => {
    setUploadStatus(false);
    setFileInfo('');
    setCurrentCallId(null);
    setTranscription('');
    setDiarizedConversation(null);
    setIntent(null);
    setAnalysis('');
    setActionItems([]);
    setDuration('00:00');
    setSentiment('0%');
    setIntentType('-');
    setPriority('-');
    setSelectedCustomer(null);
  };

  // Export handlers
  const handleExportPDF = async () => {
    if (!currentCallId) {
      alert('No report to export');
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage('Generating PDF report...');

      const response = await axios.get(
        `${API_URL}/api/analysis/reports/${currentCallId}/download`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `call-report-${currentCallId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setLoading(false);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF');
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!currentCallId) {
      alert('No report to export');
      return;
    }
    alert('CSV export feature coming soon!');
  };

  const handleShare = () => {
    if (!currentCallId) {
      alert('No report to share');
      return;
    }
    alert('Share feature coming soon!');
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={(user) => {
      // Could store user in state if needed
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <div className="app">
      <Header />

      <div className="container">
        {/* Left Column */}
        <div className="left-column">
          {/* Customer Search - NEW */}
          <CustomerSearch onCustomerSelect={handleCustomerSelect} />

          {/* Selected Customer Info - NEW */}
          {selectedCustomer && (
            <div className="card">
              <div className="card-header">
                <h3>Selected Customer</h3>
              </div>
              <div className="card-content">
                <div className="selected-customer-info">
                  <div className="customer-name-large">
                    {selectedCustomer.full_name || 'Unknown Customer'}
                  </div>
                  <div className="customer-meta">
                    <span>📞 {selectedCustomer.phone_number}</span>
                    <span>🆔 {selectedCustomer.cnic}</span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={() => setShowCustomerProfile(true)}
                  >
                    View Full Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          <UploadCard
            onSubmit={handleUploadSubmit}
            uploadStatus={uploadStatus}
            fileInfo={fileInfo}
          />
          <ConversationCard
            transcription={transcription}
            diarizedConversation={diarizedConversation}
          />
          <IntentCard intent={intent} />
        </div>

        {/* Right Column */}
        <div className="right-column">
          <MetricsRow
            duration={duration}
            sentiment={sentiment}
            intentType={intentType}
            priority={priority}
          />
          <AnalysisCard analysis={analysis} />

          {/* Sentiment Timeline - NEW */}
          {selectedCustomer && (
            <SentimentTimeline customerId={selectedCustomer.customer_id} />
          )}

          <ActionItemsCard actionItems={actionItems} />
          <BottomActions
            onNewAnalysis={resetAll}
            onExportPDF={handleExportPDF}
            onExportCSV={handleExportCSV}
            onShare={handleShare}
          />
        </div>
      </div>

      {/* Modals - NEW */}
      {showCustomerProfile && selectedCustomer && (
        <CustomerProfile
          customer={selectedCustomer}
          onViewCalls={handleViewCalls}
          onClose={() => setShowCustomerProfile(false)}
        />
      )}

      {showCallHistory && callHistoryCustomerId && (
        <CallHistory
          customerId={callHistoryCustomerId}
          onCallSelect={handleCallSelect}
          onClose={() => setShowCallHistory(false)}
        />
      )}

      <LoadingOverlay isLoading={loading} message={loadingMessage} />
    </div>
  );
}

export default App;