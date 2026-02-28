const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');

// Configure file upload
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/ogg'];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|ogg)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed! (.mp3, .wav, .m4a, .ogg)'));
        }
    }
});

/**
 * Upload audio file with customer information
 * POST /api/calls/upload
 */
router.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        const audioFile = req.file;
        if (!audioFile) {
            return res.status(400).json({ success: false, error: 'No audio file uploaded' });
        }

        const { cnic, phone_number, customer_name, customer_email } = req.body;
        let customer = null;
        let customerHistory = null;

        if (cnic || phone_number) {
            try {
                customer = await db.findOrCreateCustomer(
                    cnic || `TEMP-${Date.now()}`,
                    phone_number || `+92${Date.now()}`,
                    {
                        full_name: customer_name || 'Unknown Customer',
                        email: customer_email || null
                    }
                );

                if (phone_number) {
                    customerHistory = await db.getCustomerLastCall(phone_number);
                }
            } catch (customerError) {
                console.warn('⚠️ Customer lookup failed, continuing:', customerError.message);
            }
        }

        const dbCall = await db.createCall(
            customer?.customer_id || null,
            null,
            {
                filename: audioFile.filename,
                filepath: audioFile.path,
                size: audioFile.size,
                format: audioFile.mimetype.split('/')[1] || 'm4a'
            }
        );

        res.json({
            success: true,
            message: 'Audio uploaded successfully',
            callId: dbCall.call_id,
            filename: audioFile.originalname,
            customer: customer ? {
                customer_id: customer.customer_id,
                cnic: customer.cnic,
                full_name: customer.full_name
            } : null,
            customerHistory
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed', details: error.message });
    }
});

/**
 * Get all calls
 * GET /api/calls
 */
router.get('/', async (req, res) => {
    try {
        const query = `
      SELECT 
        call_id, customer_id, call_date, call_duration,
        audio_filename, processing_status, primary_intent,
        sentiment, quality_score
      FROM calls
      ORDER BY call_date DESC
      LIMIT 100
    `;
        const result = await db.pool.query(query);
        res.json({ success: true, totalCalls: result.rows.length, calls: result.rows });
    } catch (error) {
        console.error('Get calls error:', error);
        res.status(500).json({ success: false, error: 'Failed to get calls' });
    }
});

/**
 * Get complete call details
 * GET /api/calls/:callId
 */
router.get('/:callId', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);
        const call = await db.getCallReport(callId);
        if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
        res.json({ success: true, call });
    } catch (error) {
        console.error('Get call error:', error);
        res.status(500).json({ success: false, error: 'Failed to get call' });
    }
});

module.exports = router;
