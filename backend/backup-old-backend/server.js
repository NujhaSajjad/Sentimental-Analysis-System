// Import required packages
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Create uploads folder if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure file upload with better error handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: function (req, file, cb) {
    // Accept audio files
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/ogg'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|ogg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed! (.mp3, .wav, .m4a, .ogg)'));
    }
  }
});

// In-memory storage for calls
let calls = [];
let callIdCounter = 1;

// ============================================
// HELPER FUNCTION: Run Python Whisper
// ============================================
function runWhisperTranscription(audioPath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'whisper-service', 'transcribe.py');
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScript)) {
      return reject(new Error('Whisper transcription script not found. Please create whisper-service/transcribe.py'));
    }
    
    console.log(`🎤 Running Whisper transcription on: ${audioPath}`);
    
    const pythonProcess = spawn('python', [pythonScript, audioPath]);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.log(`Whisper: ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Whisper failed: ${errorData}`));
      }
      
      try {
        const result = JSON.parse(outputData);
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Transcription failed'));
        }
      } catch (parseError) {
        reject(new Error(`Failed to parse Whisper output: ${parseError.message}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

// ============================================
// API ENDPOINTS
// ============================================

// 1. Health Check
app.get('/health', (req, res) => {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const pythonScript = path.join(__dirname, 'whisper-service', 'transcribe.py');
  const hasWhisper = fs.existsSync(pythonScript);
  
  res.json({ 
    status: 'Backend is running!', 
    timestamp: new Date(),
    totalCalls: calls.length,
    apiStatus: {
      whisper: hasWhisper ? '✅ Ready (Local Python)' : '❌ Script Missing',
      openrouter: hasOpenRouter ? '✅ Configured' : '❌ Missing'
    }
  });
});

// 2. Upload Audio File
app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ 
        success: false,
        error: 'No audio file uploaded' 
      });
    }

    const call = {
      id: callIdCounter++,
      filename: audioFile.filename,
      filepath: audioFile.path,
      originalName: audioFile.originalname,
      size: audioFile.size,
      uploadedAt: new Date(),
      status: 'uploaded',
      transcription: null,
      intent: null,
      analysis: null,
      report: null
    };

    calls.push(call);

    console.log(`✅ File uploaded: ${audioFile.originalname} (Call ID: ${call.id})`);

    res.json({
      success: true,
      message: 'Audio uploaded successfully',
      callId: call.id,
      filename: audioFile.originalname,
      size: audioFile.size
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Upload failed', 
      details: error.message 
    });
  }
});

// Handle multer errors
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        details: 'Maximum file size is 50MB'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      details: error.message
    });
  }
  next(error);
});

// 3. Transcribe Audio (Using Local Whisper Service)
app.post('/api/transcribe/:callId', async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    const call = calls.find(c => c.id === callId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    console.log(`📝 Transcribing call ${callId} using Local Whisper Service...`);

    // Check if Whisper service is running
    try {
      await axios.get('http://localhost:5000/health');
      console.log('✅ Whisper service is running');
    } catch (healthError) {
      console.error('❌ Whisper service not running!');
      return res.status(503).json({ 
        error: 'Whisper service not available',
        message: 'Please start: python whisper_server.py in whisper-service folder'
      });
    }

    // Read the audio file
    const audioFilePath = path.resolve(call.filepath);
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error('Audio file not found on disk');
    }

    console.log(`📤 Sending audio file to Whisper service...`);

    // Create form data
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFilePath));

    // Send to Whisper service
    const response = await axios.post('http://localhost:5000/transcribe', formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000 // 2 minutes timeout
    });

    console.log(`📥 Received response from Whisper service`);

    if (response.data.success) {
      call.transcription = response.data.transcription;
      call.duration = response.data.duration;
      call.status = 'transcribed';

      console.log(`✅ Transcription completed in ${response.data.duration.toFixed(2)}s`);

      res.json({
        success: true,
        callId: call.id,
        transcription: call.transcription,
        duration: call.duration
      });
    } else {
      throw new Error('Transcription failed - no success flag');
    }

  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    
    let errorMessage = error.message;
    if (error.response) {
      errorMessage = error.response.data?.error || error.message;
      console.error('Error details:', error.response.data);
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Transcription failed', 
      details: errorMessage 
    });
  }
});

// 4. Extract Intent (Using OpenRouter)
app.post('/api/extract-intent/:callId', async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    const call = calls.find(c => c.id === callId);

    if (!call || !call.transcription) {
      return res.status(404).json({ 
        success: false,
        error: 'Call or transcription not found' 
      });
    }

    console.log(`🎯 Extracting intent for call ${callId} using OpenRouter...`);

    if (!process.env.OPENROUTER_API_KEY) {
      console.error('❌ OpenRouter API key not found!');
      return res.status(500).json({ 
        success: false,
        error: 'OpenRouter API key not configured',
        message: 'Please add OPENROUTER_API_KEY to your .env file'
      });
    }

    const intentPrompt = `Analyze this customer service call transcription and extract the following information. Respond ONLY with valid JSON, no markdown or code blocks.

Required JSON structure:
{
  "primary_intent": "one of: Query, Complaint, Request, Feedback, Technical Issue, Billing Issue, General Inquiry",
  "topics": ["topic1", "topic2", "topic3"],
  "sentiment": "one of: Positive, Neutral, Negative",
  "urgency": "one of: Low, Medium, High, Critical",
  "entities": ["entity1", "entity2"]
}

Call Transcription:
${call.transcription}

Remember: Output ONLY the JSON object, nothing else.`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat', // You can change this to any OpenRouter model
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing customer service calls. Always respond with ONLY valid JSON, no markdown formatting or code blocks.' 
          },
          { role: 'user', content: intentPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Avanza Call Analytics'
        }
      }
    );

    let intentData;
    const content = response.data.choices[0].message.content;
    
    // Clean the response (remove markdown code blocks if present)
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      intentData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response content:', content);
      throw new Error('Failed to parse intent data from AI response');
    }

    call.intent = intentData;
    call.status = 'intent_extracted';

    console.log(`✅ Intent extracted successfully`);

    res.json({
      success: true,
      callId: call.id,
      intent: intentData
    });

  } catch (error) {
    console.error('Intent extraction error:', error);
    
    let errorMessage = error.message;
    if (error.response) {
      errorMessage = error.response.data?.error?.message || error.message;
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Intent extraction failed', 
      details: errorMessage 
    });
  }
});

// 5. Generate AI Analysis (Using OpenRouter)
app.post('/api/analyze/:callId', async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    const call = calls.find(c => c.id === callId);

    if (!call || !call.transcription || !call.intent) {
      return res.status(404).json({ 
        success: false,
        error: 'Call data incomplete' 
      });
    }

    console.log(`🤖 Analyzing call ${callId} using OpenRouter...`);

    if (!process.env.OPENROUTER_API_KEY) {
      console.error('❌ OpenRouter API key not found!');
      return res.status(500).json({ 
        success: false,
        error: 'OpenRouter API key not configured',
        message: 'Please add OPENROUTER_API_KEY to your .env file'
      });
    }

    const analysisPrompt = `You are an enterprise-grade AI Call Analysis system designed to create
**customer memory and handling guidance** for CRM and call centers.

Your goal is NOT to analyze agents,
but to help a NEW agent instantly understand:
- what the customer’s problem was
- what kind of customer this is
- how to handle them properly

Do NOT invent facts.
Be clear, concise, and practical.


TRANSCRIPTION:
${call.transcription}

INTENT DATA:
${JSON.stringify(call.intent, null, 2)}

Provide the analysis using EXACTLY the following sections and headings:

### Call Summary
Briefly explain why the customer called and what the core problem was.

### Customer Pain Points
List the key concerns raised by the customer.
Focus on financial, emotional, policy, or service-related issues.

### Customer Interaction Profile
Describe the customer so a new agent knows how to deal with them.

Include:
- Emotional Tone (e.g., anxious, frustrated, calm)
- Primary Sensitivity (price, billing, delays, trust, etc.)
- Churn Risk (Low / Medium / High)
- Recommended Communication Style (reassuring, direct, empathetic, brief, etc.)

### Recommended Agent Approach
Give clear guidance for handling THIS CUSTOMER.

**Do:**
- Bullet points

**Avoid:**
- Bullet points

### Suggested Opening Line
Provide ONE natural, empathetic sentence the agent can use verbatim.

### AI Risk Assessment
Estimate:
- Churn Risk
- Escalation Risk
- Refund Likelihood

### CRM Tags
Provide short, standardized tags only.
Example:
#Cancellation #BillingConcern #PriceSensitive

### Action Items
**During the Call:**
- Bullet points

**After the Call:**
- Bullet points

### Compliance & Follow-Up Status
Use:
✔ Completed  
⚠ Pending  
❌ Missing  
`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat', // You can change this to any OpenRouter model
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert call center quality analyst with years of experience in customer service evaluation.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.5,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Avanza Call Analytics'
        }
      }
    );

    const analysis = response.data.choices[0].message.content;
    call.analysis = analysis;
    call.status = 'analyzed';

    console.log(`✅ Analysis generated successfully`);

    res.json({
      success: true,
      callId: call.id,
      analysis: analysis
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    let errorMessage = error.message;
    if (error.response) {
      errorMessage = error.response.data?.error?.message || error.message;
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Analysis failed', 
      details: errorMessage 
    });
  }
});

// 6. Generate Final Report
app.post('/api/generate-report/:callId', async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    const call = calls.find(c => c.id === callId);

    if (!call) {
      return res.status(404).json({ 
        success: false,
        error: 'Call not found' 
      });
    }

    console.log(`📊 Generating report for call ${callId}...`);

    const qualityScore = calculateQualityScore(call);
    const csatEstimate = estimateCSAT(call);

    const report = {
      callId: call.id,
      timestamp: call.uploadedAt,
      status: 'completed',
      
      transcription: {
        text: call.transcription,
        wordCount: call.transcription ? call.transcription.split(' ').length : 0,
        duration: call.duration || 0,
        language: call.language || 'unknown'
      },
      
      intent: call.intent,
      
      sentiment: {
        overall: call.intent?.sentiment || 'Neutral',
        score: call.intent?.sentiment === 'Positive' ? 0.85 : 
               call.intent?.sentiment === 'Negative' ? 0.3 : 0.5
      },
      
      analysis: call.analysis,
      
      metrics: {
        qualityScore: qualityScore,
        csatEstimate: csatEstimate,
        resolutionStatus: determineResolutionStatus(call),
        urgencyLevel: call.intent?.urgency || 'Medium'
      },
      
      recommendations: generateRecommendations(call)
    };

    call.report = report;
    call.status = 'completed';

    console.log(`✅ Report generated successfully`);

    res.json({
      success: true,
      report: report
    });

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Report generation failed', 
      details: error.message 
    });
  }
});

// 7. Complete Pipeline
app.post('/api/process-complete/:callId', async (req, res) => {
  try {
    const callId = parseInt(req.params.callId);
    
    console.log(`\n🚀 Starting complete processing for call ${callId}...`);
    
    // Step 1: Transcribe
    const transcribeRes = await axios.post(`http://localhost:${PORT}/api/transcribe/${callId}`);
    if (!transcribeRes.data.success) {
      throw new Error('Transcription failed: ' + transcribeRes.data.error);
    }
    
    // Step 2: Extract Intent
    const intentRes = await axios.post(`http://localhost:${PORT}/api/extract-intent/${callId}`);
    if (!intentRes.data.success) {
      throw new Error('Intent extraction failed: ' + intentRes.data.error);
    }
    
    // Step 3: Analyze
    const analyzeRes = await axios.post(`http://localhost:${PORT}/api/analyze/${callId}`);
    if (!analyzeRes.data.success) {
      throw new Error('Analysis failed: ' + analyzeRes.data.error);
    }
    
    // Step 4: Generate Report
    const reportRes = await axios.post(`http://localhost:${PORT}/api/generate-report/${callId}`);
    if (!reportRes.data.success) {
      throw new Error('Report generation failed: ' + reportRes.data.error);
    }
    
    console.log(`✅ Complete processing finished for call ${callId}\n`);

    res.json({
      success: true,
      message: 'Complete processing done',
      report: reportRes.data.report
    });

  } catch (error) {
    console.error('Complete processing error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Processing failed', 
      details: error.message 
    });
  }
});

// 8. Get Call Details
app.get('/api/call/:callId', (req, res) => {
  const callId = parseInt(req.params.callId);
  const call = calls.find(c => c.id === callId);

  if (!call) {
    return res.status(404).json({ 
      success: false,
      error: 'Call not found' 
    });
  }

  res.json({ success: true, call: call });
});

// 9. Get All Calls
app.get('/api/calls', (req, res) => {
  res.json({
    success: true,
    totalCalls: calls.length,
    calls: calls.map(c => ({
      id: c.id,
      filename: c.originalName,
      uploadedAt: c.uploadedAt,
      status: c.status,
      duration: c.duration
    }))
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateQualityScore(call) {
  let score = 50;
  
  if (call.intent?.sentiment === 'Positive') score += 30;
  if (call.intent?.sentiment === 'Neutral') score += 15;
  if (call.intent?.urgency === 'Low') score += 10;
  if (call.analysis && call.analysis.toLowerCase().includes('resolved')) score += 10;
  
  return Math.min(score, 100);
}

function estimateCSAT(call) {
  if (call.intent?.sentiment === 'Positive') return 4.5;
  if (call.intent?.sentiment === 'Neutral') return 3.5;
  return 2.5;
}

function determineResolutionStatus(call) {
  if (call.analysis) {
    const analysisLower = call.analysis.toLowerCase();
    if (analysisLower.includes('resolved') || analysisLower.includes('completed')) {
      return 'Resolved';
    }
    if (analysisLower.includes('pending') || analysisLower.includes('follow-up')) {
      return 'Pending';
    }
  }
  return 'In Progress';
}

function generateRecommendations(call) {
  const recommendations = [];
  
  if (call.intent?.urgency === 'High' || call.intent?.urgency === 'Critical') {
    recommendations.push('⚠️ Immediate follow-up required within 24 hours');
    recommendations.push('Escalate to senior support team for review');
  }
  
  if (call.intent?.sentiment === 'Negative') {
    recommendations.push('Send customer satisfaction survey');
    recommendations.push('Assign to quality assurance for detailed review');
    recommendations.push('Consider offering service credit or compensation');
  }
  
  if (call.intent?.sentiment === 'Positive') {
    recommendations.push('Request customer testimonial or review');
    recommendations.push('Note excellent agent performance in records');
    recommendations.push('Use as training example for other agents');
  }
  
  if (call.intent?.topics?.some(topic => 
    topic.toLowerCase().includes('technical') || 
    topic.toLowerCase().includes('bug') ||
    topic.toLowerCase().includes('error')
  )) {
    recommendations.push('Create technical support ticket for engineering team');
    recommendations.push('Document issue in knowledge base');
  }
  
  recommendations.push('Archive call recording for compliance');
  recommendations.push('Update CRM with call summary and outcomes');
  
  return recommendations;
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  
  // Check if Whisper service is running
  let whisperStatus = '❌ Not Running';
  try {
    await axios.get('http://localhost:5000/health', { timeout: 2000 });
    whisperStatus = '✅ Ready';
  } catch (error) {
    whisperStatus = '❌ Not Running';
  }
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Avanza Solutions Backend is Running!                ║
║                                                           ║
║   🌐 Server: http://localhost:${PORT}                        ║
║   💚 Health: http://localhost:${PORT}/health                ║
║                                                           ║
║   📡 API Status:                                          ║
║   • Whisper Service: ${whisperStatus}              ║
║   • OpenRouter (Analysis): ${hasOpenRouter ? '✅ Ready' : '❌ Not Configured'}          ║
║                                                           ║
║   📋 Available Endpoints:                                 ║
║   • POST /api/upload-audio                                ║
║   • POST /api/transcribe/:id (Local Whisper)             ║
║   • POST /api/extract-intent/:id (OpenRouter)            ║
║   • POST /api/analyze/:id (OpenRouter)                   ║
║   • POST /api/process-complete/:id (Full Pipeline)       ║
║   • GET  /api/calls                                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  if (!hasOpenRouter) {
    console.log(`
⚠️  WARNING: Missing OpenRouter API Key!
Add to .env: OPENROUTER_API_KEY=your-key-here
Get your key at: https://openrouter.ai/keys
    `);
  }
  
  if (whisperStatus.includes('❌')) {
    console.log(`
⚠️  WARNING: Whisper service not running!
Start it with: python whisper_server.py (in whisper-service folder)
    `);
  }
});