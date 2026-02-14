import React from 'react';
import { Clock, TrendingUp, Globe, BarChart3 } from 'lucide-react';

const MetricsRow = ({ duration, sentiment, intentType, priority }) => {
  return (
    <div className="metrics-row">
      <div className="metric-card duration">
        <div className="metric-icon">
          <Clock size={24} />
        </div>
        <div className="metric-content">
          <div className="metric-value">{duration || '00:00'}</div>
          <div className="metric-label">Duration</div>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon">
          <TrendingUp size={24} />
        </div>
        <div className="metric-content">
          <div className="metric-value">{sentiment || '0%'}</div>
          <div className="metric-label">Sentiment</div>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon">
          <Globe size={24} />
        </div>
        <div className="metric-content">
          <div className="metric-value">{intentType || '-'}</div>
          <div className="metric-label">Intent Type</div>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon">
          <BarChart3 size={24} />
        </div>
        <div className="metric-content">
          <div className="metric-value">{priority || '-'}</div>
          <div className="metric-label">Priority</div>
        </div>
      </div>
    </div>
  );
};

export default MetricsRow;