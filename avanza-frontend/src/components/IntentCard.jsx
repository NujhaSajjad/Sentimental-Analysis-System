import React from 'react';
import { Target } from 'lucide-react';

const IntentCard = ({ intent }) => {
  return (
    <div className="card">
      <div className="card-header">
        <Target size={18} />
        <h3>Intent Recognition</h3>
      </div>
      <div className="card-content">
        {intent ? (
          <div className="intent-content">
            {intent.primary_intent && (
              <div className="intent-item">
                <span className="intent-label">Primary Intent:</span>
                <span className="intent-value">{intent.primary_intent}</span>
              </div>
            )}
            
            {intent.topics && intent.topics.length > 0 && (
              <div className="intent-tags">
                {intent.topics.map((topic, index) => (
                  <span key={index} className="intent-tag">{topic}</span>
                ))}
              </div>
            )}
            
            {intent.sentiment && (
              <div className="intent-item">
                <span className="intent-label">Sentiment:</span>
                <span className="intent-value">{intent.sentiment}</span>
              </div>
            )}
            
            {intent.urgency && (
              <div className="intent-item">
                <span className="intent-label">Urgency:</span>
                <span className="intent-value">{intent.urgency}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="placeholder-text">Waiting for data...</div>
        )}
      </div>
    </div>
  );
};

export default IntentCard;