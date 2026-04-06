const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/reports
 * Fetch call reports with date filtering, sentiment/churn filtering, and pagination.
 *
 * Query params:
 *   date_from     - ISO date string, default: 30 days ago
 *   date_to       - ISO date string, default: today
 *   sentiment     - 'Positive' | 'Negative' | 'Neutral' | '' (all)
 *   churn_risk    - 'Low' | 'Medium' | 'High' | 'Critical' | '' (all)
 *   resolution    - 'pending' | 'resolved' | 'escalated' | '' (all)
 *   customer      - search string (name, cnic, phone)
 *   page          - number, default 1
 *   limit         - number, default 10
 */
router.get('/', async (req, res) => {
    try {
        const {
            date_from,
            date_to,
            sentiment = '',
            churn_risk = '',
            resolution = '',
            customer = '',
            page = 1,
            limit = 10
        } = req.query;

        // Default date range: last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const fromDate = date_from ? new Date(date_from) : thirtyDaysAgo;
        const toDate = date_to ? new Date(date_to) : new Date();

        // Ensure toDate covers the whole day
        toDate.setHours(23, 59, 59, 999);

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        // Build WHERE clauses dynamically
        const conditions = [
            `c.call_date >= $1`,
            `c.call_date <= $2`
        ];
        const params = [fromDate.toISOString(), toDate.toISOString()];

        let paramIdx = 3;

        if (sentiment) {
            conditions.push(`c.sentiment = $${paramIdx}`);
            params.push(sentiment);
            paramIdx++;
        }

        if (churn_risk) {
            // churn_risk is stored in call_reports as churn_risk_assessment
            conditions.push(`LOWER(cr.churn_risk_assessment) = LOWER($${paramIdx})`);
            params.push(churn_risk);
            paramIdx++;
        }

        if (resolution) {
            conditions.push(`c.resolution_status = $${paramIdx}`);
            params.push(resolution);
            paramIdx++;
        }

        if (customer) {
            const pattern = `%${customer}%`;
            conditions.push(`(cust.full_name ILIKE $${paramIdx} OR cust.cnic ILIKE $${paramIdx} OR cust.phone_number ILIKE $${paramIdx})`);
            params.push(pattern);
            paramIdx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // ── Stats query (no pagination) ──────────────────────────────────────────
        const statsQuery = `
            SELECT
                COUNT(*)                                                             AS total_calls,
                COUNT(*) FILTER (WHERE c.sentiment = 'Negative')                    AS negative_calls,
                ROUND(AVG(c.quality_score)::numeric, 0)                             AS avg_quality_score,
                COUNT(*) FILTER (WHERE LOWER(cr.churn_risk_assessment) IN ('high','critical')) AS high_churn_risk
            FROM calls c
            LEFT JOIN call_reports cr   ON c.call_id    = cr.call_id
            LEFT JOIN customers cust    ON c.customer_id = cust.customer_id
            ${whereClause}
        `;

        // ── Count query for pagination ───────────────────────────────────────────
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM calls c
            LEFT JOIN call_reports cr   ON c.call_id    = cr.call_id
            LEFT JOIN customers cust    ON c.customer_id = cust.customer_id
            ${whereClause}
        `;

        // ── Main data query ──────────────────────────────────────────────────────
        const dataQuery = `
            SELECT
                c.call_id,
                c.call_date,
                c.call_duration,
                c.sentiment,
                c.primary_intent,
                c.quality_score,
                c.resolution_status,
                cr.churn_risk_assessment                        AS churn_risk,
                COALESCE(cust.full_name, 'Unknown Customer')    AS customer_name,
                cust.phone_number,
                cust.cnic
            FROM calls c
            LEFT JOIN call_reports cr   ON c.call_id    = cr.call_id
            LEFT JOIN customers cust    ON c.customer_id = cust.customer_id
            ${whereClause}
            ORDER BY c.call_date DESC
            LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
        `;

        // Run all three queries in parallel
        const [statsResult, countResult, dataResult] = await Promise.all([
            db.pool.query(statsQuery, params),
            db.pool.query(countQuery, params),
            db.pool.query(dataQuery, [...params, limitNum, offset])
        ]);

        const stats = statsResult.rows[0];
        const totalRecords = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalRecords / limitNum);

        res.json({
            success: true,
            stats: {
                total_calls: parseInt(stats.total_calls) || 0,
                negative_calls: parseInt(stats.negative_calls) || 0,
                avg_quality_score: parseInt(stats.avg_quality_score) || 0,
                high_churn_risk: parseInt(stats.high_churn_risk) || 0
            },
            calls: dataResult.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalRecords,
                total_pages: totalPages
            }
        });

    } catch (error) {
        console.error('Reports route error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch report data', details: error.message });
    }
});

module.exports = router;
