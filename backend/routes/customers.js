const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * Search customers by CNIC, phone, or name
 * GET /api/customers/search?q=searchTerm
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search term must be at least 2 characters'
            });
        }

        console.log(`🔍 Searching customers: "${q}"`);
        const results = await db.searchCustomers(q);

        res.json({
            success: true,
            count: results.length,
            customers: results
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed',
            details: error.message
        });
    }
});

/**
 * Get complete customer profile
 * GET /api/customers/:cnic/profile
 */
router.get('/:cnic/profile', async (req, res) => {
    try {
        const { cnic } = req.params;
        console.log(`📋 Getting profile for CNIC: ${cnic}`);

        const profile = await db.getCustomerCompleteProfile(cnic);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        res.json({ success: true, profile: profile });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get profile',
            details: error.message
        });
    }
});

/**
 * Get all calls for a customer
 * GET /api/customers/:customerId/calls
 */
router.get('/:customerId/calls', async (req, res) => {
    try {
        const customerId = parseInt(req.params.customerId);
        console.log(`📞 Getting calls for customer: ${customerId}`);

        const calls = await db.getCustomerAllCalls(customerId);
        res.json({
            success: true,
            count: calls.length,
            calls: calls
        });
    } catch (error) {
        console.error('Calls error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get calls',
            details: error.message
        });
    }
});

/**
 * Get customer sentiment timeline
 * GET /api/customers/:customerId/sentiment-timeline
 */
router.get('/:customerId/sentiment-timeline', async (req, res) => {
    try {
        const customerId = parseInt(req.params.customerId);
        console.log(`📈 Getting sentiment timeline for customer: ${customerId}`);

        const timeline = await db.getCustomerSentimentTimeline(customerId);
        res.json({ success: true, timeline: timeline });
    } catch (error) {
        console.error('Timeline error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get sentiment timeline',
            details: error.message
        });
    }
});

module.exports = router;
