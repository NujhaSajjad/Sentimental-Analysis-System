import React from 'react';
import { FileText } from 'lucide-react';

const TranscriptionCard = ({ transcription }) => {
  return (
    <div className="card">
      <div className="card-header">
        <FileText size={18} />
        <h3>Transcription</h3>
      </div>
      <div className="card-content">
        {transcription ? (
          <div className="transcription-text">{transcription}</div>
        ) : (
          <div className="placeholder-text">Transcription will appear here...</div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionCard;