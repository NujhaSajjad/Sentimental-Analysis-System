import React, { useState } from 'react';
import { Search, User, Phone, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const CustomerSearch = ({ onCustomerSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.get(`${API_URL}/api/customers/search`, {
        params: { q: query }
      });

      if (response.data.success) {
        setSearchResults(response.data.customers);
        setShowResults(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = (customer) => {
    setShowResults(false);
    setSearchQuery('');
    onCustomerSelect(customer);
  };

  const getSentimentColor = (sentiment) => {
    if (!sentiment) return '#6B7280';
    const lowerSentiment = sentiment.toLowerCase();
    if (lowerSentiment === 'positive') return '#10B981';
    if (lowerSentiment === 'negative') return '#EF4444';
    return '#F59E0B';
  };

  const getSentimentIcon = (trend) => {
    if (!trend) return null;
    return trend === 'improving' ? 
      <TrendingUp size={14} style={{ color: '#10B981' }} /> : 
      <TrendingDown size={14} style={{ color: '#EF4444' }} />;
  };

  return (
    <div className="customer-search-container">
      <div className="search-header">
        <h2>Customer Search</h2>
        <p>Search by CNIC, phone number, or name</p>
      </div>

      <div className="search-box">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          placeholder="Enter CNIC, phone, or customer name..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
        {loading && <div className="search-spinner" />}
      </div>

      {error && (
        <div className="search-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {showResults && (
        <div className="search-results">
          {searchResults.length === 0 ? (
            <div className="no-results">
              <User size={48} style={{ color: '#D1D5DB' }} />
              <p>No customers found</p>
              <span>Try a different search term</span>
            </div>
          ) : (
            <div className="results-list">
              <div className="results-count">
                Found {searchResults.length} customer{searchResults.length !== 1 ? 's' : ''}
              </div>
              {searchResults.map((customer) => (
                <div
                  key={customer.customer_id}
                  className="customer-card"
                  onClick={() => selectCustomer(customer)}
                >
                  <div className="customer-avatar">
                    <User size={24} />
                  </div>
                  <div className="customer-info">
                    <div className="customer-name">
                      {customer.full_name || 'Unknown Customer'}
                    </div>
                    <div className="customer-details">
                      <span>
                        <CreditCard size={14} />
                        {customer.cnic}
                      </span>
                      <span>
                        <Phone size={14} />
                        {customer.phone_number}
                      </span>
                    </div>
                  </div>
                  <div className="customer-stats">
                    <div className="stat-item">
                      <span className="stat-label">Calls</span>
                      <span className="stat-value">{customer.total_calls || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Sentiment</span>
                      <span 
                        className="stat-value sentiment-badge"
                        style={{ color: getSentimentColor(customer.overall_sentiment) }}
                      >
                        {customer.overall_sentiment || 'N/A'}
                        {getSentimentIcon(customer.sentiment_trend)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
