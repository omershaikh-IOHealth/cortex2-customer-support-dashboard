import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import companionRoutes from './companion.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'your_db',
  user: process.env.DB_USER || 'your_user',
  password: process.env.DB_PASSWORD || 'your_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false }
});

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed');
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    console.log(`📊 Server time: ${res.rows[0].now}`);
  }
});

// ============= DASHBOARD METRICS =============
app.get('/api/metrics/overview', async (req, res) => {
  try {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('closed', 'resolved', 'deleted') AND (is_deleted = false OR is_deleted IS NULL)) as active_tickets,
        COUNT(*) FILTER (WHERE sla_status = 'critical' AND (is_deleted = false OR is_deleted IS NULL)) as critical_sla,
        COUNT(*) FILTER (WHERE escalation_level >= 3 AND (is_deleted = false OR is_deleted IS NULL)) as high_escalations,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND (is_deleted = false OR is_deleted IS NULL)) as tickets_24h,
        ROUND(AVG(sla_consumption_pct) FILTER (WHERE sla_status NOT IN ('resolved', 'not_applicable') AND (is_deleted = false OR is_deleted IS NULL)), 2) as avg_sla_consumption,
        COUNT(*) FILTER (WHERE sla_consumption_pct >= 100 AND (is_deleted = false OR is_deleted IS NULL)) as breached_sla
      FROM test.tickets
      WHERE company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
    `;
    
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching overview metrics:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= TICKETS =============
app.get('/api/tickets', async (req, res) => {
  try {
    const { status, priority, sla_status, escalation_level, limit = 50, offset = 0 } = req.query;
    
    let whereConditions = [
      "t.company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)",
      "(t.is_deleted = false OR t.is_deleted IS NULL)"
    ];
    
    if (status) whereConditions.push(`t.status = '${status}'`);
    if (priority) whereConditions.push(`t.priority = '${priority}'`);
    if (sla_status) whereConditions.push(`t.sla_status = '${sla_status}'`);
    if (escalation_level) whereConditions.push(`t.escalation_level >= ${escalation_level}`);
    
    const query = `
      SELECT 
        t.id,
        t.clickup_task_id,
        t.clickup_url,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.request_type,
        t.case_type,
        t.module,
        t.sla_consumption_pct,
        t.sla_status,
        t.sla_response_due,
        t.sla_resolution_due,
        t.escalation_level,
        t.last_escalation_at,
        t.ai_sentiment,
        t.created_at,
        t.updated_at,
        t.created_by_name,
        t.created_by_email,
        p.name as poc_name,
        p.email as poc_email,
        (SELECT COUNT(*) FROM test.threads WHERE ticket_id = t.id) as thread_count
      FROM test.tickets t
      LEFT JOIN test.pocs p ON t.poc_id = p.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE 
          WHEN t.sla_status = 'critical' THEN 1
          WHEN t.sla_status = 'at_risk' THEN 2
          WHEN t.escalation_level >= 3 THEN 3
          ELSE 4
        END,
        t.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single ticket with full details
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const ticketQuery = `
      SELECT 
        t.*,
        p.name as poc_name,
        p.email as poc_email,
        p.phone as poc_phone,
        c.company_name,
        c.company_code,
        s.solution_name,
        s.solution_code
      FROM test.tickets t
      LEFT JOIN test.pocs p ON t.poc_id = p.id
      LEFT JOIN test.companies c ON t.company_id = c.id
      LEFT JOIN test.solutions s ON t.solution_id = s.id
      WHERE t.id = $1
    `;
    
    const threadsQuery = `
      SELECT *
      FROM test.threads
      WHERE ticket_id = $1
      ORDER BY created_at ASC
    `;
    
    const alertsQuery = `
      SELECT *
      FROM test.sla_alerts
      WHERE ticket_id = $1
      ORDER BY created_at DESC
    `;
    
    const [ticketResult, threadsResult, alertsResult] = await Promise.all([
      pool.query(ticketQuery, [id]),
      pool.query(threadsQuery, [id]),
      pool.query(alertsQuery, [id])
    ]);
    
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json({
      ticket: ticketResult.rows[0],
      threads: threadsResult.rows,
      alerts: alertsResult.rows
    });
  } catch (err) {
    console.error('Error fetching ticket details:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= SLA MONITORING =============
app.get('/api/sla/critical', async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id,
        t.clickup_task_id,
        t.title,
        t.priority,
        t.status,
        t.sla_consumption_pct,
        t.sla_status,
        t.sla_resolution_due,
        t.escalation_level,
        t.created_at,
        p.name as poc_name
      FROM test.tickets t
      LEFT JOIN test.pocs p ON t.poc_id = p.id
      WHERE t.sla_status IN ('critical', 'at_risk', 'warning')
        AND t.status NOT IN ('closed', 'resolved', 'deleted')
        AND (t.is_deleted = false OR t.is_deleted IS NULL)
      ORDER BY t.sla_consumption_pct DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching critical SLA tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ESCALATIONS =============
app.get('/api/escalations', async (req, res) => {
  try {
    const query = `
      SELECT 
        sa.id,
        sa.ticket_id,
        sa.alert_level,
        sa.consumption_pct,
        sa.notified_emails,
        sa.notification_channel,
        sa.created_at,
        sa.is_acknowledged,
        sa.acknowledged_by,
        t.title,
        t.priority,
        t.clickup_task_id
      FROM test.sla_alerts sa
      JOIN test.tickets t ON sa.ticket_id = t.id
      WHERE t.company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
      ORDER BY sa.created_at DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching escalations:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= PROCESSING LOGS =============
app.get('/api/logs', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const query = `
      SELECT *
      FROM test.processing_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ANALYTICS =============
app.get('/api/analytics/trends', async (req, res) => {
  try {
    const query = `
      WITH daily_stats AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_tickets,
          COUNT(*) FILTER (WHERE priority IN ('P1', 'P2')) as high_priority,
          COUNT(*) FILTER (WHERE sla_consumption_pct >= 100) as breached,
          ROUND(AVG(sla_consumption_pct), 2) as avg_consumption
        FROM test.tickets
        WHERE company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
          AND created_at >= NOW() - INTERVAL '30 days'
          AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      )
      SELECT * FROM daily_stats
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching analytics trends:', err);
    res.status(500).json({ error: err.message });
  }
});

// Priority distribution
app.get('/api/analytics/priority-distribution', async (req, res) => {
  try {
    const query = `
      SELECT 
        priority,
        COUNT(*) as count,
        ROUND(AVG(sla_consumption_pct), 2) as avg_sla_consumption
      FROM test.tickets
      WHERE company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND status NOT IN ('closed', 'resolved', 'deleted')
        AND (is_deleted = false OR is_deleted IS NULL)
      GROUP BY priority
      ORDER BY priority
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching priority distribution:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= CONFIGURATIONS =============
app.get('/api/config/sla', async (req, res) => {
  try {
    const query = `
      SELECT sc.*
      FROM test.sla_configs sc
      JOIN test.solutions s ON sc.solution_id = s.id
      JOIN test.companies c ON s.company_id = c.id
      WHERE c.company_code = 'medgulf' AND s.solution_code = 'app'
      ORDER BY 
        CASE sc.priority
          WHEN 'P1' THEN 1
          WHEN 'P2' THEN 2
          WHEN 'P3' THEN 3
          WHEN 'P4' THEN 4
          WHEN 'P5' THEN 5
        END
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching SLA config:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/config/escalation', async (req, res) => {
  try {
    const query = `
      SELECT ec.*
      FROM test.escalation_configs ec
      JOIN test.solutions s ON ec.solution_id = s.id
      JOIN test.companies c ON s.company_id = c.id
      WHERE c.company_code = 'medgulf' AND s.solution_code = 'app'
      ORDER BY ec.level
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching escalation config:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - COMPANIES =============
app.get('/api/admin/companies', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM test.pocs WHERE company_id = c.id) as poc_count,
        (SELECT COUNT(*) FROM test.solutions WHERE company_id = c.id) as solution_count
      FROM test.companies c
      ORDER BY c.company_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM test.companies WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/companies', async (req, res) => {
  try {
    const { company_code, company_name, description, domain, is_active } = req.body;
    const result = await pool.query(`
      INSERT INTO test.companies (company_code, company_name, description, domain, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [company_code, company_name, description, domain, is_active !== false]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating company:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company_code, company_name, description, domain, is_active } = req.body;
    const result = await pool.query(`
      UPDATE test.companies 
      SET company_code = $1, company_name = $2, description = $3, domain = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [company_code, company_name, description, domain, is_active, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.companies WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - POCS =============
app.get('/api/admin/pocs', async (req, res) => {
  try {
    const { company_id } = req.query;
    let query = `
      SELECT p.*, c.company_name 
      FROM test.pocs p
      LEFT JOIN test.companies c ON p.company_id = c.id
    `;
    const params = [];
    if (company_id) {
      query += ' WHERE p.company_id = $1';
      params.push(company_id);
    }
    query += ' ORDER BY p.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/pocs', async (req, res) => {
  try {
    const { company_id, email, name, phone, role, status, is_primary } = req.body;
    const result = await pool.query(`
      INSERT INTO test.pocs (company_id, email, name, phone, role, status, is_primary, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [company_id, email, name, phone, role, status || 'active', is_primary || false]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/pocs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, email, name, phone, role, status, is_primary } = req.body;
    const result = await pool.query(`
      UPDATE test.pocs 
      SET company_id = $1, email = $2, name = $3, phone = $4, role = $5, status = $6, is_primary = $7, updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [company_id, email, name, phone, role, status, is_primary, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/pocs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.pocs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - SOLUTIONS =============
app.get('/api/admin/solutions', async (req, res) => {
  try {
    const { company_id } = req.query;
    let query = `
      SELECT s.*, c.company_name,
        (SELECT COUNT(*) FROM test.sla_configs WHERE solution_id = s.id) as sla_count,
        (SELECT COUNT(*) FROM test.modules WHERE solution_id = s.id) as module_count
      FROM test.solutions s
      LEFT JOIN test.companies c ON s.company_id = c.id
    `;
    const params = [];
    if (company_id) {
      query += ' WHERE s.company_id = $1';
      params.push(company_id);
    }
    query += ' ORDER BY s.solution_name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/solutions', async (req, res) => {
  try {
    const { company_id, solution_code, solution_name, description, clickup_space_id, clickup_list_id, 
            business_hours_start, business_hours_end, timezone, working_days, is_active } = req.body;
    const result = await pool.query(`
      INSERT INTO test.solutions (
        company_id, solution_code, solution_name, description, clickup_space_id, clickup_list_id,
        business_hours_start, business_hours_end, timezone, working_days, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [company_id, solution_code, solution_name, description, clickup_space_id, clickup_list_id,
        business_hours_start || '08:00', business_hours_end || '20:00', timezone || 'Asia/Dubai',
        working_days || [0,1,2,3,4,5,6], is_active !== false]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/solutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { solution_code, solution_name, description, clickup_space_id, clickup_list_id,
            business_hours_start, business_hours_end, timezone, working_days, is_active } = req.body;
    const result = await pool.query(`
      UPDATE test.solutions 
      SET solution_code = $1, solution_name = $2, description = $3, clickup_space_id = $4, 
          clickup_list_id = $5, business_hours_start = $6, business_hours_end = $7, 
          timezone = $8, working_days = $9, is_active = $10, updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [solution_code, solution_name, description, clickup_space_id, clickup_list_id,
        business_hours_start, business_hours_end, timezone, working_days, is_active, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/solutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.solutions WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - SLA CONFIGS =============
app.get('/api/admin/sla-configs', async (req, res) => {
  try {
    const { solution_id } = req.query;
    let query = `SELECT * FROM test.sla_configs`;
    const params = [];
    if (solution_id) {
      query += ' WHERE solution_id = $1';
      params.push(solution_id);
    }
    query += ' ORDER BY priority';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/sla-configs', async (req, res) => {
  try {
    const { solution_id, priority, priority_name, priority_description, response_hours, resolution_hours, resolution_type } = req.body;
    const result = await pool.query(`
      INSERT INTO test.sla_configs (solution_id, priority, priority_name, priority_description, response_hours, resolution_hours, resolution_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [solution_id, priority, priority_name, priority_description, response_hours, resolution_hours, resolution_type || 'hours']);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/sla-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority_name, priority_description, response_hours, resolution_hours, resolution_type } = req.body;
    const result = await pool.query(`
      UPDATE test.sla_configs 
      SET priority_name = $1, priority_description = $2, response_hours = $3, resolution_hours = $4, resolution_type = $5
      WHERE id = $6
      RETURNING *
    `, [priority_name, priority_description, response_hours, resolution_hours, resolution_type, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/sla-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.sla_configs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - ESCALATION CONFIGS =============
app.get('/api/admin/escalation-configs', async (req, res) => {
  try {
    const { solution_id } = req.query;
    let query = `SELECT * FROM test.escalation_configs`;
    const params = [];
    if (solution_id) {
      query += ' WHERE solution_id = $1';
      params.push(solution_id);
    }
    query += ' ORDER BY level';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/escalation-configs', async (req, res) => {
  try {
    const { solution_id, level, threshold_percent, level_name, notify_roles, action_description } = req.body;
    const result = await pool.query(`
      INSERT INTO test.escalation_configs (solution_id, level, threshold_percent, level_name, notify_roles, action_description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [solution_id, level, threshold_percent, level_name, notify_roles, action_description]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/escalation-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { threshold_percent, level_name, notify_roles, action_description } = req.body;
    const result = await pool.query(`
      UPDATE test.escalation_configs 
      SET threshold_percent = $1, level_name = $2, notify_roles = $3, action_description = $4
      WHERE id = $5
      RETURNING *
    `, [threshold_percent, level_name, notify_roles, action_description, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/escalation-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.escalation_configs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - ASSIGNEES =============
app.get('/api/admin/assignees', async (req, res) => {
  try {
    const { solution_id } = req.query;
    let query = `SELECT * FROM test.assignee_configs`;
    const params = [];
    if (solution_id) {
      query += ' WHERE solution_id = $1';
      params.push(solution_id);
    }
    query += ' ORDER BY role_code, person_name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/assignees', async (req, res) => {
  try {
    const { solution_id, role_code, role_name, person_name, email, clickup_user_id, is_active } = req.body;
    const result = await pool.query(`
      INSERT INTO test.assignee_configs (solution_id, role_code, role_name, person_name, email, clickup_user_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [solution_id, role_code, role_name, person_name, email, clickup_user_id, is_active !== false]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/assignees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role_code, role_name, person_name, email, clickup_user_id, is_active } = req.body;
    const result = await pool.query(`
      UPDATE test.assignee_configs 
      SET role_code = $1, role_name = $2, person_name = $3, email = $4, clickup_user_id = $5, is_active = $6
      WHERE id = $7
      RETURNING *
    `, [role_code, role_name, person_name, email, clickup_user_id, is_active, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/assignees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.assignee_configs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - MODULES =============
app.get('/api/admin/modules', async (req, res) => {
  try {
    const { solution_id } = req.query;
    let query = `SELECT * FROM test.modules`;
    const params = [];
    if (solution_id) {
      query += ' WHERE solution_id = $1';
      params.push(solution_id);
    }
    query += ' ORDER BY module_name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/modules', async (req, res) => {
  try {
    const { solution_id, module_code, module_name, description } = req.body;
    const result = await pool.query(`
      INSERT INTO test.modules (solution_id, module_code, module_name, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [solution_id, module_code, module_name, description]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/modules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { module_code, module_name, description } = req.body;
    const result = await pool.query(`
      UPDATE test.modules 
      SET module_code = $1, module_name = $2, description = $3
      WHERE id = $4
      RETURNING *
    `, [module_code, module_name, description, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/modules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.modules WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - REQUEST TYPES =============
app.get('/api/admin/request-types', async (req, res) => {
  try {
    const { solution_id } = req.query;
    let query = `SELECT * FROM test.request_types`;
    const params = [];
    if (solution_id) {
      query += ' WHERE solution_id = $1';
      params.push(solution_id);
    }
    query += ' ORDER BY request_type';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/request-types', async (req, res) => {
  try {
    const { solution_id, request_type, description, sla_applicable } = req.body;
    const result = await pool.query(`
      INSERT INTO test.request_types (solution_id, request_type, description, sla_applicable)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [solution_id, request_type, description, sla_applicable !== false]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/request-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { request_type, description, sla_applicable } = req.body;
    const result = await pool.query(`
      UPDATE test.request_types 
      SET request_type = $1, description = $2, sla_applicable = $3
      WHERE id = $4
      RETURNING *
    `, [request_type, description, sla_applicable, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/request-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.request_types WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - CASE TYPES =============
app.get('/api/admin/case-types', async (req, res) => {
  try {
    const { solution_id, request_type_id } = req.query;
    let query = `
      SELECT ct.*, rt.request_type 
      FROM test.case_types ct
      LEFT JOIN test.request_types rt ON ct.request_type_id = rt.id
      WHERE 1=1
    `;
    const params = [];
    if (solution_id) {
      query += ' AND ct.solution_id = $' + (params.length + 1);
      params.push(solution_id);
    }
    if (request_type_id) {
      query += ' AND ct.request_type_id = $' + (params.length + 1);
      params.push(request_type_id);
    }
    query += ' ORDER BY ct.case_type';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/case-types', async (req, res) => {
  try {
    const { solution_id, request_type_id, case_type, description, default_priority } = req.body;
    const result = await pool.query(`
      INSERT INTO test.case_types (solution_id, request_type_id, case_type, description, default_priority)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [solution_id, request_type_id, case_type, description, default_priority]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/case-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { case_type, description, default_priority } = req.body;
    const result = await pool.query(`
      UPDATE test.case_types 
      SET case_type = $1, description = $2, default_priority = $3
      WHERE id = $4
      RETURNING *
    `, [case_type, description, default_priority, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/case-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.case_types WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= ADMIN - KPI CONFIGS =============
app.get('/api/admin/kpis', async (req, res) => {
  try {
    const { solution_id } = req.query;
    let query = `SELECT * FROM test.kpi_configs`;
    const params = [];
    if (solution_id) {
      query += ' WHERE solution_id = $1';
      params.push(solution_id);
    }
    query += ' ORDER BY kpi_name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/kpis', async (req, res) => {
  try {
    const { solution_id, kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency } = req.body;
    const result = await pool.query(`
      INSERT INTO test.kpi_configs (solution_id, kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [solution_id, kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/kpis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency } = req.body;
    const result = await pool.query(`
      UPDATE test.kpi_configs 
      SET kpi_code = $1, kpi_name = $2, description = $3, calculation_method = $4, target_value = $5, unit = $6, report_frequency = $7
      WHERE id = $8
      RETURNING *
    `, [kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/kpis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM test.kpi_configs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= HEALTH CHECK =============
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

app.use('/api/companion', companionRoutes(pool));

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Cortex Backend API running on http://localhost:${PORT}`);
});

// WebSocket for real-time updates
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📡 WebSocket client connected');
  ws.on('close', () => console.log('📴 WebSocket client disconnected'));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    pool.end();
    console.log('Server closed');
  });
});