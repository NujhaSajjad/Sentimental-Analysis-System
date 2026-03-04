// server.js - Scalable Avanza Solutions Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require('./database');

// Import routers
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const callRoutes = require('./routes/calls');
const analysisRoutes = require('./routes/analysis');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'], // Added Vite default just in case
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Create uploads folder if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Health Check
app.get('/health', async (req, res) => {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  let dbStatus = '❌ Not Connected';
  try {
    await db.pool.query('SELECT 1');
    dbStatus = '✅ Connected';
  } catch (error) {
    dbStatus = `❌ Error: ${error.message}`;
  }

  res.json({
    status: 'Backend is running!',
    timestamp: new Date(),
    database: dbStatus,
    openrouter: hasOpenRouter ? '✅ Configured' : '❌ Missing'
  });
});

// Mount Routes
app.use('/api', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/analysis', analysisRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// Check environment variables before starting
const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
if (!hasOpenRouter) {
  console.warn('\n⚠️ WARNING: OPENROUTER_API_KEY is not set in .env file');
  console.warn('⚠️ AI Analysis features will fail. Please add your key.\n');
}

// Start Server
app.listen(PORT, async () => {
  // Initialize schema (ensure dynamic columns exist)
  await db.initSchema();

  // Test database connection on startup
  let dbStatus = '⏳ Connecting...';
  try {
    const result = await db.pool.query('SELECT NOW()');
    if (result.rows.length > 0) {
      dbStatus = '✅ Connected';
    }
  } catch (error) {
    dbStatus = `❌ Error: ${error.message}`;
    console.error('Database connection failed:', error);
  }

  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ✅ Avanza Solutions Backend is Running!            ║
║                                                      ║
║   📡 Port: ${PORT.toString().padEnd(41)} ║
║   🔗 URL: http://localhost:${PORT.toString().padEnd(25)} ║
║   🗄️  DB Status: ${dbStatus.padEnd(35)} ║
║   🤖 AI Config: ${hasOpenRouter ? '✅ OpenRouter Key Found'.padEnd(36) : '❌ Missing OpenRouter Key'.padEnd(36)} ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);
});
