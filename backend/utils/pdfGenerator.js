// pdfGenerator.js - Professional PDF Report Generator
const PDFDocument = require('pdfkit');

/**
 * Generate a professional PDF report for a call
 * @param {Object} reportData - Complete call report data from database
 * @returns {Promise<Buffer>} PDF file as buffer
 */
async function generateReportPDF(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: `Call Report - ${reportData.call_id}`,
          Author: 'Avanza Solutions',
          Subject: 'Call Analysis Report',
          Keywords: 'call analytics, sentiment analysis, customer service'
        }
      });
      
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colors
      const primaryColor = '#7C3AED'; // Purple
      const secondaryColor = '#EC4899'; // Pink
      const textColor = '#1F2937';
      const grayColor = '#6B7280';
      
      // ========================================
      // HEADER
      // ========================================
      doc
        .fontSize(28)
        .fillColor(primaryColor)
        .text('Avanza Solutions', { align: 'center' })
        .fontSize(14)
        .fillColor(grayColor)
        .text('AI-Powered Call Analytics & Customer Intelligence', { align: 'center' })
        .moveDown(0.5);

      // Divider
      doc
        .strokeColor(primaryColor)
        .lineWidth(3)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown();

      doc
        .fontSize(18)
        .fillColor(textColor)
        .text('Call Analysis Report', { align: 'center' })
        .moveDown(1.5);

      // ========================================
      // CUSTOMER & CALL INFORMATION
      // ========================================
      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .text('Customer Information', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(11)
        .fillColor(textColor);

      const customerInfo = [
        ['Customer Name:', reportData.customer_name || 'N/A'],
        ['CNIC:', reportData.cnic || 'N/A'],
        ['Phone:', reportData.phone_number || 'N/A'],
        ['Email:', reportData.customer_email || 'N/A'],
        ['Customer Tier:', (reportData.customer_tier || 'standard').toUpperCase()]
      ];

      customerInfo.forEach(([label, value]) => {
        doc
          .fillColor(grayColor)
          .text(label, 50, doc.y, { continued: true, width: 150 })
          .fillColor(textColor)
          .text(value, { width: 350 });
      });

      doc.moveDown(1);

      // Call Details
      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .text('Call Details', { underline: true })
        .moveDown(0.5);

      doc.fontSize(11).fillColor(textColor);

      const callDate = new Date(reportData.call_date);
      const duration = reportData.call_duration || 0;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;

      const callInfo = [
        ['Call ID:', `#${reportData.call_id}`],
        ['Date & Time:', callDate.toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })],
        ['Duration:', `${minutes}m ${seconds}s`],
        ['Status:', (reportData.call_status || 'completed').toUpperCase()],
        ['Agent:', reportData.agent_name || 'Unassigned']
      ];

      callInfo.forEach(([label, value]) => {
        doc
          .fillColor(grayColor)
          .text(label, 50, doc.y, { continued: true, width: 150 })
          .fillColor(textColor)
          .text(value, { width: 350 });
      });

      doc.moveDown(2);

      // ========================================
      // SENTIMENT ANALYSIS
      // ========================================
      doc.addPage();
      
      doc
        .fontSize(16)
        .fillColor(primaryColor)
        .text('Sentiment Analysis', { underline: true })
        .moveDown(1);

      // Sentiment box
      const sentiment = reportData.sentiment || 'Neutral';
      const sentimentScore = reportData.sentiment_score || 0;
      const sentimentColor = sentiment === 'Positive' ? '#10B981' :
                            sentiment === 'Negative' ? '#EF4444' : '#6B7280';

      doc
        .roundedRect(50, doc.y, 495, 80, 5)
        .fillAndStroke(sentimentColor, sentimentColor)
        .fillColor('#FFFFFF')
        .fontSize(24)
        .text(sentiment, 60, doc.y + 20, { width: 475, align: 'center' })
        .fontSize(14)
        .text(`Score: ${sentimentScore.toFixed(1)}`, 60, doc.y - 30, { width: 475, align: 'center' });

      doc.moveDown(6);

      // Emotional Analysis
      doc.fontSize(11).fillColor(textColor);

      const emotionalInfo = [
        ['Emotional Tone:', reportData.emotional_tone || 'N/A'],
        ['Intensity:', (reportData.emotional_intensity || 'medium').toUpperCase()],
        ['Communication Style:', reportData.customer_overall_sentiment || 'N/A']
      ];

      emotionalInfo.forEach(([label, value]) => {
        doc
          .fillColor(grayColor)
          .text(label, 50, doc.y, { continued: true, width: 180 })
          .fillColor(textColor)
          .text(value, { width: 320 });
      });

      doc.moveDown(2);

      // ========================================
      // CALL SUMMARY
      // ========================================
      if (reportData.call_summary) {
        doc
          .fontSize(14)
          .fillColor(primaryColor)
          .text('Call Summary', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(10)
          .fillColor(textColor)
          .text(reportData.call_summary, { align: 'justify', lineGap: 2 })
          .moveDown(1.5);
      }

      // ========================================
      // INTENT & CLASSIFICATION
      // ========================================
      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .text('Intent & Classification', { underline: true })
        .moveDown(0.5);

      doc.fontSize(11).fillColor(textColor);

      const intentInfo = [
        ['Primary Intent:', reportData.primary_intent || 'N/A'],
        ['Urgency Level:', (reportData.urgency || 'medium').toUpperCase()],
        ['Category:', reportData.call_category || 'General Inquiry'],
        ['Resolution:', (reportData.resolution_status || 'pending').toUpperCase()]
      ];

      intentInfo.forEach(([label, value]) => {
        doc
          .fillColor(grayColor)
          .text(label, 50, doc.y, { continued: true, width: 180 })
          .fillColor(textColor)
          .text(value, { width: 320 });
      });

      doc.moveDown(2);

      // ========================================
      // QUALITY METRICS
      // ========================================
      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .text('Quality Metrics', { underline: true })
        .moveDown(0.5);

      const qualityScore = reportData.quality_score || 0;
      const csatScore = reportData.csat_estimate || 0;

      // Quality Score Bar
      const barWidth = 400;
      const barHeight = 25;
      const qualityBarFill = (qualityScore / 100) * barWidth;

      doc
        .fontSize(11)
        .fillColor(textColor)
        .text('Quality Score:', 50, doc.y);

      doc
        .rect(50, doc.y + 5, barWidth, barHeight)
        .fillAndStroke('#E5E7EB', '#D1D5DB');

      const qualityColor = qualityScore >= 80 ? '#10B981' :
                          qualityScore >= 60 ? '#F59E0B' : '#EF4444';

      doc
        .rect(50, doc.y - barHeight, qualityBarFill, barHeight)
        .fillAndStroke(qualityColor, qualityColor);

      doc
        .fillColor('#FFFFFF')
        .fontSize(12)
        .text(`${qualityScore.toFixed(0)}/100`, 50 + qualityBarFill - 40, doc.y - barHeight + 6);

      doc.moveDown(2);

      // CSAT Estimate
      doc
        .fillColor(textColor)
        .fontSize(11)
        .text('Customer Satisfaction (CSAT):', 50, doc.y, { continued: true })
        .text(` ${csatScore.toFixed(1)}/5.0 ⭐`);

      doc.moveDown(2);

      // ========================================
      // RISK ASSESSMENT
      // ========================================
      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .text('Risk Assessment', { underline: true })
        .moveDown(0.5);

      const churnRisk = reportData.churn_risk_assessment || 'low';
      const churnColor = churnRisk === 'critical' || churnRisk === 'high' ? '#EF4444' :
                        churnRisk === 'medium' ? '#F59E0B' : '#10B981';

      doc.fontSize(11);

      [
        ['Churn Risk:', churnRisk.toUpperCase(), churnColor],
        ['Escalation Risk:', (reportData.escalation_risk || 'low').toUpperCase(), '#6B7280'],
        ['Refund Likelihood:', (reportData.refund_likelihood || 'low').toUpperCase(), '#6B7280']
      ].forEach(([label, value, color]) => {
        doc
          .fillColor(grayColor)
          .text(label, 50, doc.y, { continued: true, width: 180 })
          .fillColor(color)
          .text(value, { width: 320 });
      });

      doc.moveDown(2);

      // ========================================
      // FULL TRANSCRIPTION (New Page)
      // ========================================
      if (reportData.transcription_text) {
        doc.addPage();
        
        doc
          .fontSize(16)
          .fillColor(primaryColor)
          .text('Call Transcription', { underline: true })
          .moveDown(1);

        doc
          .fontSize(9)
          .fillColor(textColor)
          .text(reportData.transcription_text, { 
            align: 'justify', 
            lineGap: 3,
            columns: 1
          })
          .moveDown(1);

        // Word count
        doc
          .fontSize(8)
          .fillColor(grayColor)
          .text(`Words: ${reportData.word_count || 0} | Confidence: ${((reportData.confidence_score || 0) * 100).toFixed(0)}%`, {
            align: 'right'
          });
      }

      // ========================================
      // KEY INSIGHTS (If available)
      // ========================================
      if (reportData.key_insights && reportData.key_insights.length > 0) {
        doc.addPage();
        
        doc
          .fontSize(16)
          .fillColor(primaryColor)
          .text('Key Insights', { underline: true })
          .moveDown(1);

        reportData.key_insights.forEach((insight, index) => {
          doc
            .fontSize(10)
            .fillColor(textColor)
            .text(`${index + 1}. ${insight}`, { 
              indent: 20,
              lineGap: 4
            })
            .moveDown(0.5);
        });
      }

      // ========================================
      // RECOMMENDED ACTIONS
      // ========================================
      if (reportData.agent_approach_do && reportData.agent_approach_do.length > 0) {
        if (doc.y > 650) doc.addPage();
        
        doc
          .fontSize(14)
          .fillColor(primaryColor)
          .text('Recommended Agent Approach', { underline: true })
          .moveDown(1);

        doc
          .fontSize(12)
          .fillColor('#10B981')
          .text('DO:', { underline: true })
          .moveDown(0.5);

        reportData.agent_approach_do.forEach((item) => {
          doc
            .fontSize(10)
            .fillColor(textColor)
            .text(`✓ ${item}`, { indent: 20, lineGap: 3 })
            .moveDown(0.3);
        });

        doc.moveDown(1);

        if (reportData.agent_approach_avoid && reportData.agent_approach_avoid.length > 0) {
          doc
            .fontSize(12)
            .fillColor('#EF4444')
            .text('AVOID:', { underline: true })
            .moveDown(0.5);

          reportData.agent_approach_avoid.forEach((item) => {
            doc
              .fontSize(10)
              .fillColor(textColor)
              .text(`✗ ${item}`, { indent: 20, lineGap: 3 })
              .moveDown(0.3);
          });
        }
      }

      // ========================================
      // FOOTER (on every page)
      // ========================================
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        // Footer line
        doc
          .strokeColor('#E5E7EB')
          .lineWidth(1)
          .moveTo(50, doc.page.height - 70)
          .lineTo(550, doc.page.height - 70)
          .stroke();

        // Footer text
        doc
          .fontSize(8)
          .fillColor(grayColor)
          .text(
            `Generated on ${new Date().toLocaleString()} | Report ID: ${reportData.call_id} | Page ${i + 1} of ${pageCount}`,
            50,
            doc.page.height - 60,
            { align: 'center', width: 500 }
          );

        doc
          .fontSize(7)
          .text(
            'Avanza Solutions © 2026 | Confidential Customer Information',
            50,
            doc.page.height - 45,
            { align: 'center', width: 500 }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a simple summary PDF (lighter version)
 * @param {Object} reportData - Call report data
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateSummaryPDF(reportData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Simple header
    doc
      .fontSize(20)
      .text('Call Summary Report', { align: 'center' })
      .moveDown();

    // Basic info
    doc
      .fontSize(12)
      .text(`Call ID: ${reportData.call_id}`)
      .text(`Date: ${new Date(reportData.call_date).toLocaleString()}`)
      .text(`Customer: ${reportData.customer_name || 'N/A'}`)
      .text(`Sentiment: ${reportData.sentiment || 'N/A'}`)
      .text(`Quality: ${reportData.quality_score || 'N/A'}/100`)
      .moveDown();

    // Summary
    if (reportData.call_summary) {
      doc
        .fontSize(11)
        .text(reportData.call_summary, { align: 'justify' });
    }

    doc.end();
  });
}

module.exports = {
  generateReportPDF,
  generateSummaryPDF
};