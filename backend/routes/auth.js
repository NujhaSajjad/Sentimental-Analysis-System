const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * @route POST /api/login
 * @desc Simple login to match credentials against the users table
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const result = await db.pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            user: { id: user.id, email: user.email, role: user.role, name: 'Admin User' }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
