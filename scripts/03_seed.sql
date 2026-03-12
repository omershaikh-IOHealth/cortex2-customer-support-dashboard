-- =============================================================================
-- SEED: IOHealth (Full Wipe + Re-seed)
-- Run AFTER 02_migration.sql
-- Run AFTER 01_curl_add_fields.sh and update solution_custom_fields section below
--
-- Step 0: Run this first to preserve Ann & Asif credentials:
--   SELECT id, email, password_hash, ziwo_email, ziwo_password, clickup_token_enc
--   FROM main.users WHERE email IN ('ann.shruthy@iohealth.com','asif.k@iohealth.com');
--   → Paste results into a text file before continuing.
--
-- Omer initial password: Cortex2024! (bcrypt hash below — change after first login)
-- =============================================================================

-- ─── WIPE (order matters for FK constraints) ─────────────────────────────────
TRUNCATE
  main.sla_alerts,
  main.processing_logs,
  main.notification_queue,
  main.notifications,
  main.qa_scores,
  main.threads,
  main.call_logs,
  main.break_requests,
  main.briefing_acks,
  main.shift_swaps,
  main.shift_breaks,
  main.shift_rotas,
  main.leave_requests,
  main.circular_acks,
  main.circular_versions,
  main.circulars,
  main.auth_logs,
  main.agent_status_history,
  main.agent_status,
  main.ai_companion_sessions,
  main.tickets,
  main.solution_custom_fields,
  main.assignee_configs,
  main.escalation_configs,
  main.sla_configs,
  main.kpi_configs,
  main.case_types,
  main.request_types,
  main.modules,
  main.pocs,
  main.solutions,
  main.users,
  main.companies
  RESTART IDENTITY CASCADE;

-- ─── COMPANIES ───────────────────────────────────────────────────────────────
INSERT INTO main.companies (id, company_code, company_name, description, domain, is_active)
VALUES (1, 'iohealth', 'IOHealth', 'IOHealth digital health platform', 'iohealth.com', true);

SELECT setval('main.companies_id_seq', 1);

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Ann & Asif: REPLACE the password_hash values below with the ones you saved in Step 0.
-- Omer: initial password is Cortex2024! — change after first login.

INSERT INTO main.users (id, email, password_hash, full_name, role, ziwo_email, ziwo_password, is_active)
VALUES
  -- ADMINS (real users — replace password_hash with preserved values)
  (1, 'ann.shruthy@iohealth.com',
      'REPLACE_WITH_PRESERVED_HASH_FOR_ANN',
      'Ann Shruthy', 'admin',
      'ann.shruthy@iohealth.com', 'REPLACE_WITH_PRESERVED_ZIWO_PASSWORD_FOR_ANN',
      true),
  (2, 'asif.k@iohealth.com',
      'REPLACE_WITH_PRESERVED_HASH_FOR_ASIF',
      'Asif K', 'agent',
      'asif.k@iohealth.com', 'REPLACE_WITH_PRESERVED_ZIWO_PASSWORD_FOR_ASIF',
      true),
  (3, 'omer.shaikh@iohealth.com',
      '$2b$10$Zje5KWkUtMDYvmPpCPaK1e7ASP1eSrITg8YweYGJkWvYlPRV9vKN.',
      'Omer Shaikh', 'admin',
      'omer.shaikh@iohealth.com', NULL,
      true),
  -- SYNTHETIC AGENTS
  (4, 'sarah.alrashidi@iohealth.com',
      '$2b$10$Zje5KWkUtMDYvmPpCPaK1e7ASP1eSrITg8YweYGJkWvYlPRV9vKN.',
      'Sarah Al Rashidi', 'agent', NULL, NULL, true),
  (5, 'mohammed.hassan@iohealth.com',
      '$2b$10$Zje5KWkUtMDYvmPpCPaK1e7ASP1eSrITg8YweYGJkWvYlPRV9vKN.',
      'Mohammed Hassan', 'agent', NULL, NULL, true),
  (6, 'fatima.alzaabi@iohealth.com',
      '$2b$10$Zje5KWkUtMDYvmPpCPaK1e7ASP1eSrITg8YweYGJkWvYlPRV9vKN.',
      'Fatima Al Zaabi', 'agent', NULL, NULL, true),
  (7, 'khalid.ahmed@iohealth.com',
      '$2b$10$Zje5KWkUtMDYvmPpCPaK1e7ASP1eSrITg8YweYGJkWvYlPRV9vKN.',
      'Khalid Ahmed', 'agent', NULL, NULL, true);

SELECT setval('main.users_id_seq', 7);

-- ─── AGENT STATUS ────────────────────────────────────────────────────────────
INSERT INTO main.agent_status (user_id, status, status_note, set_at)
VALUES
  (2, 'available', NULL, NOW()),
  (4, 'available', NULL, NOW()),
  (5, 'available', NULL, NOW()),
  (6, 'available', NULL, NOW()),
  (7, 'available', NULL, NOW());

-- ─── SOLUTIONS ───────────────────────────────────────────────────────────────
-- space_id = 90126395854 for all (IOH - test space)
INSERT INTO main.solutions
  (id, company_id, solution_code, solution_name, description,
   clickup_space_id, clickup_list_id, solution_type,
   business_hours_start, business_hours_end, timezone, working_days, is_active)
VALUES
  (1, 1, 'IOH-SUPPORT', 'IOH - Support',
   'Customer-facing support tickets for IOHealth app',
   '90126395854', '901215777514', 'support',
   '08:00', '20:00', 'Asia/Dubai', '{0,1,2,3,4,5,6}', true),
  (2, 1, 'IOH-TESTING', 'IOH - Testing',
   'QA and testing tickets for IOHealth',
   '90126395854', '901216234294', 'testing',
   '08:00', '20:00', 'Asia/Dubai', '{0,1,2,3,4,5,6}', true),
  (3, 1, 'IOH-DEV', 'IOH - Dev',
   'Development and engineering tickets for IOHealth',
   '90126395854', '901216234304', 'development',
   '08:00', '20:00', 'Asia/Dubai', '{0,1,2,3,4,5,6}', true);

SELECT setval('main.solutions_id_seq', 3);

-- ─── SOLUTION CUSTOM FIELDS ──────────────────────────────────────────────────
-- IOH - Support (solution_id=1): Request Type and Case Type already known.
-- Source field UUID: REPLACE with the id returned from curl 1/7 above.
-- IOH - Testing (solution_id=2): REPLACE all UUIDs with responses from curls 2/3/4.
-- IOH - Dev (solution_id=3): REPLACE all UUIDs with responses from curls 5/6/7.
--
-- How to find the UUID: in the curl response, look for "id": "xxxxxxxx-..."
-- Options UUIDs are under type_config.options[].id

INSERT INTO main.solution_custom_fields (solution_id, field_key, clickup_field_id, options)
VALUES
  -- IOH-SUPPORT: Request Type (existing list-level field)
  (1, 'request_type', '83ff465c-0075-495c-aeb8-7db8cc56110a', '{
    "Incident":        "037ea1a4-88f0-43d0-9bd9-386fc385aaac",
    "Service Request": "2adace70-cf37-48aa-9b74-c05f5df185b6",
    "Problem":         "44f3a550-7b10-4e57-b59b-efbb63b6fb9c",
    "Change Request":  "904d1493-1ef1-4bfe-a731-40c825c28963"
  }'),
  -- IOH-SUPPORT: Case Type (existing list-level field)
  (1, 'case_type', 'de899780-bc87-4ec2-ba94-fe01690ab330', '{
    "Availability":   "71924ef3-bd27-46f4-af4b-986f21db3b9d",
    "Core Function":  "75b4337c-75d0-46b8-a849-618e19f1fbdd",
    "Integration":    "7d6f15a1-2bef-4989-a5c4-9d79adbc28b1",
    "Data Integrity": "d960b7a3-005c-4b72-a64d-a438fd6980ee",
    "Performance":    "7c02067a-2703-4dd2-80c7-53a412b52302",
    "Stability":      "2a69eb54-c762-44da-bb36-41a568dcd10a",
    "Security":       "9412cc67-a469-436f-a875-617ddedf28c8",
    "UI / UX":        "f6116b75-c6ca-452c-9737-a4859b211495",
    "Support":        "4ea73a69-a682-41ec-96e3-3ffb32fb45cd",
    "Access":         "1cd65a2e-89fa-4771-be97-1f9fe6002a1d",
    "Problem Record": "11115504-b918-4ad9-addb-49b02973978a",
    "Enhancement":    "6c05810f-baba-4bc8-aed5-efa9fb2ce86e"
  }'),
  -- IOH-SUPPORT: Source (NEW — replace field ID and option UUIDs from curl 1/7)
  (1, 'source', 'REPLACE_SOURCE_FIELD_ID_FROM_CURL_1', '{
    "email":   "REPLACE_EMAIL_OPT_UUID",
    "voice":   "REPLACE_VOICE_OPT_UUID",
    "apex":    "REPLACE_APEX_OPT_UUID",
    "clickup": "REPLACE_CLICKUP_OPT_UUID"
  }'),

  -- IOH-TESTING: Request Type (NEW — replace from curl 2/7)
  (2, 'request_type', 'REPLACE_RT_FIELD_ID_TESTING', '{
    "Incident":        "REPLACE_INC_OPT_TESTING",
    "Service Request": "REPLACE_SR_OPT_TESTING",
    "Problem":         "REPLACE_PROB_OPT_TESTING",
    "Change Request":  "REPLACE_CR_OPT_TESTING"
  }'),
  -- IOH-TESTING: Case Type (NEW — replace from curl 3/7)
  (2, 'case_type', 'REPLACE_CT_FIELD_ID_TESTING', '{
    "Availability":   "REPLACE_AVAIL_OPT_TESTING",
    "Core Function":  "REPLACE_CF_OPT_TESTING",
    "Integration":    "REPLACE_INT_OPT_TESTING",
    "Data Integrity": "REPLACE_DI_OPT_TESTING",
    "Performance":    "REPLACE_PERF_OPT_TESTING",
    "Stability":      "REPLACE_STAB_OPT_TESTING",
    "Security":       "REPLACE_SEC_OPT_TESTING",
    "UI / UX":        "REPLACE_UI_OPT_TESTING",
    "Support":        "REPLACE_SUP_OPT_TESTING",
    "Access":         "REPLACE_ACC_OPT_TESTING",
    "Problem Record": "REPLACE_PR_OPT_TESTING",
    "Enhancement":    "REPLACE_ENH_OPT_TESTING"
  }'),
  -- IOH-TESTING: Source (NEW — replace from curl 4/7)
  (2, 'source', 'REPLACE_SOURCE_FIELD_ID_TESTING', '{
    "email":   "REPLACE_EMAIL_OPT_TESTING",
    "voice":   "REPLACE_VOICE_OPT_TESTING",
    "apex":    "REPLACE_APEX_OPT_TESTING",
    "clickup": "REPLACE_CLICKUP_OPT_TESTING"
  }'),

  -- IOH-DEV: Request Type (NEW — replace from curl 5/7)
  (3, 'request_type', 'REPLACE_RT_FIELD_ID_DEV', '{
    "Incident":        "REPLACE_INC_OPT_DEV",
    "Service Request": "REPLACE_SR_OPT_DEV",
    "Problem":         "REPLACE_PROB_OPT_DEV",
    "Change Request":  "REPLACE_CR_OPT_DEV"
  }'),
  -- IOH-DEV: Case Type (NEW — replace from curl 6/7)
  (3, 'case_type', 'REPLACE_CT_FIELD_ID_DEV', '{
    "Availability":   "REPLACE_AVAIL_OPT_DEV",
    "Core Function":  "REPLACE_CF_OPT_DEV",
    "Integration":    "REPLACE_INT_OPT_DEV",
    "Data Integrity": "REPLACE_DI_OPT_DEV",
    "Performance":    "REPLACE_PERF_OPT_DEV",
    "Stability":      "REPLACE_STAB_OPT_DEV",
    "Security":       "REPLACE_SEC_OPT_DEV",
    "UI / UX":        "REPLACE_UI_OPT_DEV",
    "Support":        "REPLACE_SUP_OPT_DEV",
    "Access":         "REPLACE_ACC_OPT_DEV",
    "Problem Record": "REPLACE_PR_OPT_DEV",
    "Enhancement":    "REPLACE_ENH_OPT_DEV"
  }'),
  -- IOH-DEV: Source (NEW — replace from curl 7/7)
  (3, 'source', 'REPLACE_SOURCE_FIELD_ID_DEV', '{
    "email":   "REPLACE_EMAIL_OPT_DEV",
    "voice":   "REPLACE_VOICE_OPT_DEV",
    "apex":    "REPLACE_APEX_OPT_DEV",
    "clickup": "REPLACE_CLICKUP_OPT_DEV"
  }');

-- ─── SLA CONFIGS ─────────────────────────────────────────────────────────────
-- Same SLA policy across all 3 solutions for now
INSERT INTO main.sla_configs (solution_id, priority, priority_name, priority_description, response_hours, resolution_hours)
VALUES
  -- IOH-SUPPORT
  (1, 'P1', 'Critical',    'Complete outage / data loss',          1,   4),
  (1, 'P2', 'High',        'Major feature broken',                 2,   8),
  (1, 'P3', 'Medium',      'Partial disruption',                   4,  24),
  (1, 'P4', 'Low',         'Minor issue',                          8,  72),
  (1, 'P5', 'Very Low',    'Cosmetic / enhancement',              24, 168),
  -- IOH-TESTING
  (2, 'P1', 'Critical',    'Blocker — cannot proceed with testing', 1,   4),
  (2, 'P2', 'High',        'Major test case failure',               2,   8),
  (2, 'P3', 'Medium',      'Partial test coverage gap',             4,  24),
  (2, 'P4', 'Low',         'Minor test issue',                      8,  72),
  (2, 'P5', 'Very Low',    'Cosmetic test finding',                24, 168),
  -- IOH-DEV
  (3, 'P1', 'Critical',    'Production incident / hotfix',          1,   4),
  (3, 'P2', 'High',        'Sprint blocker',                        2,   8),
  (3, 'P3', 'Medium',      'Standard dev ticket',                   4,  24),
  (3, 'P4', 'Low',         'Tech debt / cleanup',                   8,  72),
  (3, 'P5', 'Very Low',    'Nice to have',                         24, 168);

-- ─── ESCALATION CONFIGS ──────────────────────────────────────────────────────
INSERT INTO main.escalation_configs (solution_id, level, threshold_percent, level_name, notify_roles, action_description)
VALUES
  (1, 1, 65,  'Yellow Alert',  ARRAY['admin'],         'First warning: review and assign priority action'),
  (1, 2, 78,  'Orange Alert',  ARRAY['admin'],         'Escalation to team lead: status update required within 1 hour'),
  (1, 3, 85,  'Red Alert',     ARRAY['admin'],         'Management escalation: executive notification and war room'),
  (1, 4, 90,  'Critical',      ARRAY['admin'],         'SLA breach imminent: all hands on deck'),
  (2, 1, 65,  'Yellow Alert',  ARRAY['admin'],         'Testing SLA warning'),
  (2, 2, 78,  'Orange Alert',  ARRAY['admin'],         'Testing SLA escalation'),
  (2, 3, 85,  'Red Alert',     ARRAY['admin'],         'Testing SLA critical'),
  (2, 4, 90,  'Critical',      ARRAY['admin'],         'Testing SLA breach'),
  (3, 1, 65,  'Yellow Alert',  ARRAY['admin'],         'Dev SLA warning'),
  (3, 2, 78,  'Orange Alert',  ARRAY['admin'],         'Dev SLA escalation'),
  (3, 3, 85,  'Red Alert',     ARRAY['admin'],         'Dev SLA critical'),
  (3, 4, 90,  'Critical',      ARRAY['admin'],         'Dev SLA breach');

-- ─── ASSIGNEE CONFIGS ────────────────────────────────────────────────────────
INSERT INTO main.assignee_configs (solution_id, role_code, role_name, person_name, email, clickup_user_id, is_active)
VALUES
  (1, 'L1_SUPPORT',  'L1 Support Agent',   'Asif K',       'asif.k@iohealth.com',       '87796566', true),
  (1, 'L2_SUPPORT',  'L2 Support Lead',    'Ann Shruthy',  'ann.shruthy@iohealth.com',  '81799932', true),
  (1, 'MANAGER',     'Support Manager',    'Omer Shaikh',  'omer.shaikh@iohealth.com',  '93735320', true),
  (2, 'QA_LEAD',     'QA Lead',            'Ann Shruthy',  'ann.shruthy@iohealth.com',  '81799932', true),
  (2, 'MANAGER',     'QA Manager',         'Omer Shaikh',  'omer.shaikh@iohealth.com',  '93735320', true),
  (3, 'TECH_LEAD',   'Tech Lead',          'Asif K',       'asif.k@iohealth.com',       '87796566', true),
  (3, 'MANAGER',     'Engineering Manager','Omer Shaikh',  'omer.shaikh@iohealth.com',  '93735320', true);

-- ─── MODULES ─────────────────────────────────────────────────────────────────
INSERT INTO main.modules (solution_id, module_code, module_name, description)
VALUES
  (1, 'LOGIN',       'Login / Sign Up',        'Authentication and onboarding'),
  (1, 'CLAIMS',      'Claims',                 'Insurance claim submissions'),
  (1, 'APPOINTMENTS','Appointments',           'Doctor appointment booking'),
  (1, 'MY_HEALTH',   'My Health',              'Personal health records'),
  (1, 'DIGITAL_TWIN','Digital Twin',           'AI health twin features'),
  (1, 'WELLNESS',    'Wellness',               'Wellness programs and tracking'),
  (1, 'PHARMACY',    'Pharmacy',               'Medication and pharmacy services'),
  (1, 'AI_COMPANION','AI Companion',           'AI assistant features'),
  (1, 'PAYMENTS',    'Payments',               'Billing and payments'),
  (1, 'GENERAL',     'General',                'General or uncategorised issues'),
  (2, 'QA_GENERAL',  'QA General',             'General QA tracking'),
  (2, 'QA_REGRESSION','QA Regression',         'Regression test tracking'),
  (3, 'DEV_BACKEND', 'Backend',                'API and backend engineering'),
  (3, 'DEV_FRONTEND','Frontend',               'Web and mobile frontend'),
  (3, 'DEV_DEVOPS',  'DevOps',                 'Infrastructure and deployment');

-- ─── REQUEST TYPES ───────────────────────────────────────────────────────────
INSERT INTO main.request_types (solution_id, request_type, description, sla_applicable)
VALUES
  (1, 'Incident',        'Unexpected disruption to service',         true),
  (1, 'Service Request', 'Standard request for support or info',     true),
  (1, 'Problem',         'Root cause investigation',                 true),
  (1, 'Change Request',  'Planned change to configuration/feature',  false),
  (2, 'Incident',        'Testing blocker',                          true),
  (2, 'Service Request', 'QA assistance request',                    false),
  (3, 'Incident',        'Production bug',                           true),
  (3, 'Change Request',  'Feature development request',              false);

-- ─── CASE TYPES ──────────────────────────────────────────────────────────────
INSERT INTO main.case_types (solution_id, case_type, description, default_priority)
VALUES
  (1, 'Availability',   'Service or feature unavailable',           'P1'),
  (1, 'Core Function',  'Core feature not working correctly',       'P2'),
  (1, 'Integration',    'Third-party integration failure',          'P2'),
  (1, 'Data Integrity', 'Data missing, corrupt, or incorrect',      'P2'),
  (1, 'Performance',    'Slow response or timeout',                 'P3'),
  (1, 'Stability',      'Crashes or instability',                   'P2'),
  (1, 'Security',       'Security vulnerability or breach concern', 'P1'),
  (1, 'UI / UX',        'Interface issue or poor experience',       'P4'),
  (1, 'Support',        'General support assistance',               'P3'),
  (1, 'Access',         'Login or permission issue',                'P2'),
  (1, 'Enhancement',    'Feature improvement request',              'P5');

-- ─── POCS ────────────────────────────────────────────────────────────────────
INSERT INTO main.pocs (id, company_id, email, name, phone, role, status, is_primary, is_vip)
VALUES
  (1, 1, 'yousuf.ali@iohealth.com',     'Yousuf Ali',     '+971501112233', 'Product Manager', 'active', true,  true),
  (2, 1, 'layla.hassan@iohealth.com',   'Layla Hassan',   '+971502223344', 'QA Engineer',     'active', false, false),
  (3, 1, 'ibrahim.omar@iohealth.com',   'Ibrahim Omar',   '+971503334455', 'Dev Lead',        'active', false, false),
  (4, 1, 'nour.khalid@iohealth.com',    'Nour Khalid',    '+971504445566', 'End User',        'active', false, false),
  (5, 1, 'test.user@iohealth.com',      'Test User',      '+971505556677', 'Tester',          'active', false, false);

SELECT setval('main.pocs_id_seq', 5);

-- ─── KPI CONFIGS ─────────────────────────────────────────────────────────────
INSERT INTO main.kpi_configs (solution_id, kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency)
VALUES
  (1, 'FCR',       'First Contact Resolution', 'Tickets resolved on first contact', 'resolved_first_contact / total_tickets * 100', 80,  '%',       'weekly'),
  (1, 'SLA_COMP',  'SLA Compliance',           'Tickets resolved within SLA',       'within_sla / total_tickets * 100',             95,  '%',       'weekly'),
  (1, 'CSAT',      'Customer Satisfaction',    'Average CSAT score',                'sum(csat_scores) / count(csat_scores)',         4.5, 'out of 5','monthly'),
  (1, 'AVG_HANDLE','Avg Handle Time',          'Average resolution time in hours',  'sum(resolution_hours) / count(tickets)',        24,  'hours',   'weekly');

-- ─── SYSTEM SETTINGS ─────────────────────────────────────────────────────────
INSERT INTO main.system_settings (key, value)
VALUES
  ('clickup_api_token',   'pk_93735320_XU6SZJQGN677F46481KDAUGANNZU1GOT'),
  ('default_company_id',  '1'),
  ('app_version',         '2.0.0'),
  ('maintenance_mode',    'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ─── TICKETS ─────────────────────────────────────────────────────────────────
-- 20 tickets across Support solution:
--   5 voice, 5 apex, 5 email (with zoho_ticket_id), 5 clickup (native clickup tasks)
-- ClickUp task IDs for voice/apex tickets: set to NULL (will be pushed by workflow)
-- ClickUp task IDs for 'clickup' channel tickets: fake IDs (workflow will not try to push these)
-- ClickUp task IDs for 'email' tickets: NULL (created by Zoho→ClickUp workflow)

INSERT INTO main.tickets (
  id, company_id, solution_id, poc_id, assigned_to_id, assigned_to_email, assigned_to_name,
  clickup_task_id, clickup_url,
  title, description, module, request_type, case_type, priority, status, channel,
  sla_response_due, sla_resolution_due, sla_consumption_pct, sla_status,
  ai_summary, ai_sentiment, escalation_level,
  created_by_email, created_by_name,
  created_at, updated_at
) VALUES

-- ── VOICE TICKETS (channel = 'voice') ──────────────────────────────────────
(1,  1, 1, 4, 2, 'asif.k@iohealth.com', 'Asif K', NULL, NULL,
 'Patient unable to login after password reset',
 'Customer called in to report that after resetting their password via the app, they are still unable to log in. Error: "Invalid credentials". Customer ID: 10023456.',
 'Login / Sign Up', 'Incident', 'Access', 'P2', 'In Progress', 'voice',
 NOW() - INTERVAL '3 hours' + INTERVAL '2 hours',
 NOW() - INTERVAL '3 hours' + INTERVAL '8 hours',
 37.5, 'healthy',
 'Patient cannot log in after password reset, receiving invalid credentials error.',
 'frustrated', 0,
 'asif.k@iohealth.com', 'Asif K',
 NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours'),

(2,  1, 1, 1, 4, 'sarah.alrashidi@iohealth.com', 'Sarah Al Rashidi', NULL, NULL,
 'Claims portal showing wrong insurance balance',
 'Member reports their insurance balance on the Claims screen shows SAR 0 despite having active coverage. Verified coverage is active in backend. Policy no: GRP-2024-8821.',
 'Claims', 'Incident', 'Data Integrity', 'P2', 'Open', 'voice',
 NOW() - INTERVAL '5 hours' + INTERVAL '2 hours',
 NOW() - INTERVAL '5 hours' + INTERVAL '8 hours',
 62.5, 'warning',
 'Insurance balance showing as zero despite active coverage on Claims screen.',
 'negative', 1,
 'sarah.alrashidi@iohealth.com', 'Sarah Al Rashidi',
 NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours'),

(3,  1, 1, 2, 5, 'mohammed.hassan@iohealth.com', 'Mohammed Hassan', NULL, NULL,
 'App crashing on Appointments screen for iOS 17 users',
 'Multiple callers reporting the Appointments tab causes an immediate crash on iOS 17.x devices. Not reproducible on Android or older iOS versions.',
 'Appointments', 'Incident', 'Stability', 'P1', 'In Progress', 'voice',
 NOW() - INTERVAL '1 hour' + INTERVAL '1 hour',
 NOW() - INTERVAL '1 hour' + INTERVAL '4 hours',
 25.0, 'healthy',
 'Appointments screen crashes on iOS 17 devices immediately upon opening.',
 'negative', 0,
 'mohammed.hassan@iohealth.com', 'Mohammed Hassan',
 NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes'),

(4,  1, 1, 3, 6, 'fatima.alzaabi@iohealth.com', 'Fatima Al Zaabi', NULL, NULL,
 'Digital Twin data not syncing with wearable device',
 'Customer reports their Fitbit data has not updated in the Digital Twin for 4 days. Last sync shown: 3 days ago. Device: Fitbit Charge 6.',
 'Digital Twin', 'Incident', 'Integration', 'P3', 'Open', 'voice',
 NOW() - INTERVAL '8 hours' + INTERVAL '4 hours',
 NOW() - INTERVAL '8 hours' + INTERVAL '24 hours',
 33.3, 'healthy',
 'Digital Twin not syncing Fitbit data for 4 days, last sync was 3 days ago.',
 'neutral', 0,
 'fatima.alzaabi@iohealth.com', 'Fatima Al Zaabi',
 NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours'),

(5,  1, 1, 4, 7, 'khalid.ahmed@iohealth.com', 'Khalid Ahmed', NULL, NULL,
 'Payment gateway timeout during claim reimbursement',
 'Customer attempted to submit a reimbursement claim for SAR 1,250 but payment gateway timed out. Transaction ID: TXN-20240315-9923. No charge was made but claim not submitted.',
 'Payments', 'Incident', 'Availability', 'P2', 'Resolved', 'voice',
 NOW() - INTERVAL '2 days' + INTERVAL '2 hours',
 NOW() - INTERVAL '2 days' + INTERVAL '8 hours',
 100.0, 'resolved',
 'Payment gateway timeout prevented claim reimbursement submission, no charge made.',
 'neutral', 0,
 'khalid.ahmed@iohealth.com', 'Khalid Ahmed',
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

-- ── APEX TICKETS (channel = 'apex', created via dashboard) ─────────────────
(6,  1, 1, 1, 2, 'asif.k@iohealth.com', 'Asif K', NULL, NULL,
 'AI Companion giving incorrect medication reminders',
 'Reported via dashboard: AI Companion is sending medication reminders at wrong times. Patient set reminders for 8AM and 8PM but receiving them at 11AM and 11PM. Timezone: Asia/Dubai.',
 'AI Companion', 'Incident', 'Core Function', 'P2', 'Open', 'apex',
 NOW() - INTERVAL '2 hours' + INTERVAL '2 hours',
 NOW() - INTERVAL '2 hours' + INTERVAL '8 hours',
 25.0, 'healthy',
 'AI Companion sending medication reminders 3 hours late due to likely timezone issue.',
 'negative', 0,
 'ann.shruthy@iohealth.com', 'Ann Shruthy',
 NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),

(7,  1, 1, 2, 4, 'sarah.alrashidi@iohealth.com', 'Sarah Al Rashidi', NULL, NULL,
 'Wellness program progress resetting weekly',
 'Dashboard ticket: User''s 30-day wellness challenge progress resets every Monday. Expected behaviour: progress should accumulate over 30 days. User ID: USR-884421.',
 'Wellness', 'Problem', 'Core Function', 'P3', 'In Progress', 'apex',
 NOW() - INTERVAL '6 hours' + INTERVAL '4 hours',
 NOW() - INTERVAL '6 hours' + INTERVAL '24 hours',
 25.0, 'healthy',
 'Wellness program progress resets weekly instead of accumulating over 30 days.',
 'frustrated', 0,
 'omer.shaikh@iohealth.com', 'Omer Shaikh',
 NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours'),

(8,  1, 1, 3, 5, 'mohammed.hassan@iohealth.com', 'Mohammed Hassan', NULL, NULL,
 'Pharmacy order stuck in processing status for 3 days',
 'Dashboard escalation: Pharmacy order ORD-2024-5567 has been in ''Processing'' status for 72 hours. Customer has been waiting for essential medication. Insurance pre-auth was approved.',
 'Pharmacy', 'Incident', 'Availability', 'P1', 'In Progress', 'apex',
 NOW() - INTERVAL '30 minutes' + INTERVAL '1 hour',
 NOW() - INTERVAL '30 minutes' + INTERVAL '4 hours',
 12.5, 'healthy',
 'Pharmacy order stuck in processing for 72 hours, customer awaiting essential medication.',
 'angry', 0,
 'ann.shruthy@iohealth.com', 'Ann Shruthy',
 NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '15 minutes'),

(9,  1, 1, 4, 6, 'fatima.alzaabi@iohealth.com', 'Fatima Al Zaabi', NULL, NULL,
 'My Health section not loading lab results',
 'Created from dashboard: My Health → Lab Results tab shows spinner indefinitely. Reproduced on both iOS and Android. Lab results are available in the system (verified via admin panel).',
 'My Health', 'Incident', 'Performance', 'P3', 'Open', 'apex',
 NOW() - INTERVAL '10 hours' + INTERVAL '4 hours',
 NOW() - INTERVAL '10 hours' + INTERVAL '24 hours',
 41.7, 'healthy',
 'Lab Results tab fails to load in My Health section on all platforms.',
 'neutral', 0,
 'omer.shaikh@iohealth.com', 'Omer Shaikh',
 NOW() - INTERVAL '10 hours', NOW() - INTERVAL '9 hours'),

(10, 1, 1, 5, 7, 'khalid.ahmed@iohealth.com', 'Khalid Ahmed', NULL, NULL,
 'Feature request: bulk appointment cancellation',
 'Dashboard feature request: Super-users and clinic admins need the ability to cancel multiple appointments at once (e.g., during a doctor''s sick leave). Currently must cancel one by one.',
 'Appointments', 'Change Request', 'Enhancement', 'P5', 'Open', 'apex',
 NOW() - INTERVAL '3 days' + INTERVAL '24 hours',
 NOW() - INTERVAL '3 days' + INTERVAL '168 hours',
 71.4, 'warning',
 'Request for bulk appointment cancellation feature for clinic admins.',
 'positive', 1,
 'ann.shruthy@iohealth.com', 'Ann Shruthy',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),

-- ── EMAIL TICKETS (channel = 'email', via Zoho Desk) ───────────────────────
(11, 1, 1, 1, 2, 'asif.k@iohealth.com', 'Asif K', NULL, NULL,
 'Cannot access Chronic Care program - enrolled but locked out',
 'Email from yousuf.ali@iohealth.com: I enrolled in the Chronic Care management program last week and the confirmation email was received, but when I open the app and navigate to Care Journey > Chronic Care, it says I have no active programs. Please resolve urgently.',
 'My Health', 'Incident', 'Access', 'P2', 'Open', 'email',
 NOW() - INTERVAL '4 hours' + INTERVAL '2 hours',
 NOW() - INTERVAL '4 hours' + INTERVAL '8 hours',
 50.0, 'healthy',
 'User enrolled in Chronic Care program but cannot access it - shows no active programs.',
 'frustrated', 0,
 'yousuf.ali@iohealth.com', 'Yousuf Ali',
 NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours'),

(12, 1, 1, 2, 4, 'sarah.alrashidi@iohealth.com', 'Sarah Al Rashidi', NULL, NULL,
 'Incorrect doctor profile information displayed',
 'Email from layla.hassan@iohealth.com: The profile for Dr. Ahmed Al Mansoori (Dr ID: DOC-3312) is showing incorrect specialisation (showing Paediatrics instead of Cardiology) and wrong clinic address. Patients are booking appointments at the wrong location.',
 'Appointments', 'Incident', 'Data Integrity', 'P2', 'In Progress', 'email',
 NOW() - INTERVAL '7 hours' + INTERVAL '2 hours',
 NOW() - INTERVAL '7 hours' + INTERVAL '8 hours',
 87.5, 'critical',
 'Doctor profile showing wrong specialisation and clinic address, causing booking errors.',
 'negative', 2,
 'layla.hassan@iohealth.com', 'Layla Hassan',
 NOW() - INTERVAL '7 hours', NOW() - INTERVAL '6 hours'),

(13, 1, 1, 3, 5, 'mohammed.hassan@iohealth.com', 'Mohammed Hassan', NULL, NULL,
 'eRx prescription not visible after doctor issued it',
 'Email from ibrahim.omar@iohealth.com: My doctor issued an electronic prescription this morning (Rx No: ERX-2024-44521) but it does not appear in my app under eRx Orders. Doctor confirmed it was submitted. I need the medication urgently.',
 'Pharmacy', 'Incident', 'Integration', 'P1', 'In Progress', 'email',
 NOW() - INTERVAL '2 hours' + INTERVAL '1 hour',
 NOW() - INTERVAL '2 hours' + INTERVAL '4 hours',
 50.0, 'healthy',
 'eRx prescription not appearing in patient app after doctor submission.',
 'angry', 0,
 'ibrahim.omar@iohealth.com', 'Ibrahim Omar',
 NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),

(14, 1, 1, 4, 6, 'fatima.alzaabi@iohealth.com', 'Fatima Al Zaabi', NULL, NULL,
 'Push notifications not received on Android 14',
 'Email from nour.khalid@iohealth.com: Since upgrading to Android 14, I no longer receive push notifications from the app (appointment reminders, wellness tips, etc.). Notifications are enabled in device settings. Device: Samsung Galaxy S24.',
 'General', 'Incident', 'Core Function', 'P3', 'Open', 'email',
 NOW() - INTERVAL '12 hours' + INTERVAL '4 hours',
 NOW() - INTERVAL '12 hours' + INTERVAL '24 hours',
 50.0, 'healthy',
 'Push notifications stopped working on Android 14 after OS upgrade.',
 'neutral', 0,
 'nour.khalid@iohealth.com', 'Nour Khalid',
 NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours'),

(15, 1, 1, 5, 7, 'khalid.ahmed@iohealth.com', 'Khalid Ahmed', NULL, NULL,
 'Service request: add Arabic language support for AI Companion',
 'Email from test.user@iohealth.com: The AI Companion currently responds only in English. As our user base is primarily Arabic-speaking, we request full Arabic language support including RTL text and Arabic medical terminology.',
 'AI Companion', 'Service Request', 'Enhancement', 'P4', 'Closed', 'email',
 NOW() - INTERVAL '14 days' + INTERVAL '8 hours',
 NOW() - INTERVAL '14 days' + INTERVAL '72 hours',
 100.0, 'resolved',
 'Request for Arabic language support in AI Companion including RTL and medical terms.',
 'positive', 0,
 'test.user@iohealth.com', 'Test User',
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),

-- ── CLICKUP TICKETS (channel = 'clickup', created natively in ClickUp) ──────
-- These have fake but plausible clickup_task_id values (will be replaced when ClickUp is flushed/re-seeded)
(16, 1, 1, 1, 2, 'asif.k@iohealth.com', 'Asif K',
 'cu_test_001', 'https://app.clickup.com/t/cu_test_001',
 'Backend API returning 500 on /health-parameters endpoint',
 'Raised directly in ClickUp by dev team: The GET /api/health-parameters endpoint started returning HTTP 500 errors as of the last deployment. Affects the Digital Twin and My Health screens.',
 'Digital Twin', 'Incident', 'Availability', 'P1', 'In Progress', 'clickup',
 NOW() - INTERVAL '45 minutes' + INTERVAL '1 hour',
 NOW() - INTERVAL '45 minutes' + INTERVAL '4 hours',
 18.75, 'healthy',
 'GET /api/health-parameters returning 500 errors since last deployment.',
 'negative', 0,
 'asif.k@iohealth.com', 'Asif K',
 NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '30 minutes'),

(17, 1, 1, 2, 4, 'sarah.alrashidi@iohealth.com', 'Sarah Al Rashidi',
 'cu_test_002', 'https://app.clickup.com/t/cu_test_002',
 'Implement rate limiting on OTP endpoint',
 'Security task created in ClickUp: The /api/auth/otp endpoint has no rate limiting. A brute force attack is theoretically possible. Need to implement 5 attempts per 10 minutes per IP.',
 'Login / Sign Up', 'Change Request', 'Security', 'P2', 'Open', 'clickup',
 NOW() - INTERVAL '1 day' + INTERVAL '2 hours',
 NOW() - INTERVAL '1 day' + INTERVAL '8 hours',
 100.0, 'breached',
 'OTP endpoint lacks rate limiting, vulnerable to brute force attacks.',
 'neutral', 3,
 'asif.k@iohealth.com', 'Asif K',
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours'),

(18, 1, 1, 3, 5, 'mohammed.hassan@iohealth.com', 'Mohammed Hassan',
 'cu_test_003', 'https://app.clickup.com/t/cu_test_003',
 'Database query optimisation for appointment list',
 'Dev task: The appointments list query takes 3–8 seconds for users with >50 appointments. Need to add composite index on (user_id, appointment_date, status) and implement cursor-based pagination.',
 'Appointments', 'Problem', 'Performance', 'P3', 'In Progress', 'clickup',
 NOW() - INTERVAL '3 days' + INTERVAL '4 hours',
 NOW() - INTERVAL '3 days' + INTERVAL '24 hours',
 100.0, 'breached',
 'Appointments list slow for users with 50+ appointments, needs index and pagination.',
 'neutral', 2,
 'asif.k@iohealth.com', 'Asif K',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),

(19, 1, 1, 4, 6, 'fatima.alzaabi@iohealth.com', 'Fatima Al Zaabi',
 'cu_test_004', 'https://app.clickup.com/t/cu_test_004',
 'Integrate HL7 FHIR for lab results import',
 'Integration task: Implement HL7 FHIR R4 standard for importing lab results from partner laboratories. Scope: inbound FHIR DiagnosticReport resources, mapping to our health_parameters schema.',
 'My Health', 'Change Request', 'Integration', 'P3', 'Open', 'clickup',
 NOW() - INTERVAL '5 days' + INTERVAL '4 hours',
 NOW() - INTERVAL '5 days' + INTERVAL '24 hours',
 100.0, 'breached',
 'Need to implement HL7 FHIR R4 for lab result imports from partner labs.',
 'neutral', 2,
 'asif.k@iohealth.com', 'Asif K',
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),

(20, 1, 1, 5, 7, 'khalid.ahmed@iohealth.com', 'Khalid Ahmed',
 'cu_test_005', 'https://app.clickup.com/t/cu_test_005',
 'Add dark mode support to mobile app',
 'UX improvement task from ClickUp: Implement system-aware dark mode across all app screens. Priority: Settings, Home, Appointments, Claims. Design specs attached in ClickUp task description.',
 'General', 'Service Request', 'UI / UX', 'P4', 'Open', 'clickup',
 NOW() - INTERVAL '7 days' + INTERVAL '8 hours',
 NOW() - INTERVAL '7 days' + INTERVAL '72 hours',
 100.0, 'breached',
 'Request to implement system-aware dark mode across all main app screens.',
 'positive', 2,
 'asif.k@iohealth.com', 'Asif K',
 NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days');

SELECT setval('main.tickets_id_seq', 20);

-- Set zoho_ticket_id for email tickets (synthetic Zoho ticket IDs)
UPDATE main.tickets SET zoho_ticket_id = '2024031101' WHERE id = 11;
UPDATE main.tickets SET zoho_ticket_id = '2024031102' WHERE id = 12;
UPDATE main.tickets SET zoho_ticket_id = '2024031103' WHERE id = 13;
UPDATE main.tickets SET zoho_ticket_id = '2024031104' WHERE id = 14;
UPDATE main.tickets SET zoho_ticket_id = '2024031105' WHERE id = 15;

-- Set resolved/closed timestamps
UPDATE main.tickets SET resolved_at = NOW() - INTERVAL '1 day' WHERE id = 5;
UPDATE main.tickets SET resolved_at = NOW() - INTERVAL '10 days', closed_at = NOW() - INTERVAL '10 days' WHERE id = 15;

-- ─── THREADS ─────────────────────────────────────────────────────────────────
INSERT INTO main.threads
  (ticket_id, action_type, actor_email, actor_name, old_value, new_value, raw_content, thread_source, created_at)
VALUES
  -- Ticket 1 (voice)
  (1, 'ticket_created',  'asif.k@iohealth.com',         'Asif K',         NULL,         'Open',        'Voice ticket created for login issue after password reset.',                    'internal',  NOW() - INTERVAL '3 hours'),
  (1, 'comment',         'asif.k@iohealth.com',         'Asif K',         NULL,          NULL,         'Checked with auth team. Password reset token appears valid. Escalating to L2.', 'internal',  NOW() - INTERVAL '2 hours'),
  (1, 'status_change',   'ann.shruthy@iohealth.com',    'Ann Shruthy',    'Open',       'In Progress', NULL,                                                                            'internal',  NOW() - INTERVAL '1 hour 30 minutes'),

  -- Ticket 2 (voice)
  (2, 'ticket_created',  'sarah.alrashidi@iohealth.com','Sarah Al Rashidi',NULL,         'Open',        'Voice call: insurance balance showing 0 despite active policy.',                'internal',  NOW() - INTERVAL '5 hours'),
  (2, 'comment',         'sarah.alrashidi@iohealth.com','Sarah Al Rashidi',NULL,          NULL,         'Verified coverage active in backend. Likely a sync issue with insurance API.',  'internal',  NOW() - INTERVAL '4 hours'),
  (2, 'escalation',      'system',                      'System',          NULL,          NULL,         'SLA 65% consumed — Yellow Alert escalation triggered.',                         'clickup',   NOW() - INTERVAL '3 hours'),

  -- Ticket 3 (voice - P1)
  (3, 'ticket_created',  'mohammed.hassan@iohealth.com','Mohammed Hassan', NULL,         'Open',        'Multiple callers: Appointments tab crashes on iOS 17.',                         'internal',  NOW() - INTERVAL '1 hour'),
  (3, 'status_change',   'mohammed.hassan@iohealth.com','Mohammed Hassan', 'Open',       'In Progress', NULL,                                                                            'internal',  NOW() - INTERVAL '45 minutes'),

  -- Ticket 6 (apex)
  (6, 'ticket_created',  'ann.shruthy@iohealth.com',    'Ann Shruthy',    NULL,         'Open',        'Dashboard: AI Companion sending medication reminders 3 hours late.',             'internal',  NOW() - INTERVAL '2 hours'),
  (6, 'comment',         'asif.k@iohealth.com',         'Asif K',         NULL,          NULL,         'Reproducing: Dubai timezone offset hardcoded to UTC+3 instead of UTC+4.',         'internal',  NOW() - INTERVAL '1 hour'),

  -- Ticket 8 (apex - P1)
  (8, 'ticket_created',  'ann.shruthy@iohealth.com',    'Ann Shruthy',    NULL,         'Open',        'Dashboard escalation: pharmacy order stuck 72 hours.',                           'internal',  NOW() - INTERVAL '30 minutes'),
  (8, 'comment',         'mohammed.hassan@iohealth.com','Mohammed Hassan', NULL,          NULL,         'Contacting pharmacy integration team. Order is in error state in pharmacy system.','internal', NOW() - INTERVAL '20 minutes'),

  -- Ticket 11 (email)
  (11,'ticket_created',  'yousuf.ali@iohealth.com',     'Yousuf Ali',     NULL,         'Open',        'Email received: Cannot access Chronic Care program after enrollment.',            'email',     NOW() - INTERVAL '4 hours'),
  (11,'comment',         'asif.k@iohealth.com',         'Asif K',         NULL,          NULL,         'Enrollment record found in DB. Sync job may have failed. Checking Care Journey service.','internal', NOW() - INTERVAL '3 hours'),

  -- Ticket 12 (email - escalated)
  (12,'ticket_created',  'layla.hassan@iohealth.com',   'Layla Hassan',   NULL,         'Open',        'Email: Doctor profile showing wrong specialisation and clinic address.',          'email',     NOW() - INTERVAL '7 hours'),
  (12,'status_change',   'sarah.alrashidi@iohealth.com','Sarah Al Rashidi','Open',      'In Progress', NULL,                                                                            'internal',  NOW() - INTERVAL '6 hours'),
  (12,'escalation',      'system',                      'System',          NULL,          NULL,         'SLA 78% consumed — Orange Alert escalation triggered.',                         'clickup',   NOW() - INTERVAL '4 hours'),
  (12,'escalation',      'system',                      'System',          NULL,          NULL,         'SLA 87% consumed — Red Alert escalation triggered.',                            'clickup',   NOW() - INTERVAL '2 hours'),

  -- Ticket 13 (email - P1)
  (13,'ticket_created',  'ibrahim.omar@iohealth.com',   'Ibrahim Omar',   NULL,         'Open',        'Email: eRx prescription ERX-2024-44521 not appearing in patient app.',          'email',     NOW() - INTERVAL '2 hours'),
  (13,'status_change',   'mohammed.hassan@iohealth.com','Mohammed Hassan', 'Open',       'In Progress', NULL,                                                                            'internal',  NOW() - INTERVAL '1 hour 30 minutes'),

  -- Ticket 16 (clickup)
  (16,'ticket_created',  'asif.k@iohealth.com',         'Asif K',         NULL,         'Open',        'Created in ClickUp: /health-parameters returning 500 since last deploy.',       'clickup',   NOW() - INTERVAL '45 minutes'),

  -- Ticket 17 (clickup - breached)
  (17,'ticket_created',  'asif.k@iohealth.com',         'Asif K',         NULL,         'Open',        'Security: OTP endpoint needs rate limiting.',                                   'clickup',   NOW() - INTERVAL '1 day'),
  (17,'escalation',      'system',                      'System',          NULL,          NULL,         'SLA 65% — Yellow Alert',                                                        'clickup',   NOW() - INTERVAL '22 hours'),
  (17,'escalation',      'system',                      'System',          NULL,          NULL,         'SLA 85% — Red Alert',                                                           'clickup',   NOW() - INTERVAL '20 hours'),
  (17,'escalation',      'system',                      'System',          NULL,          NULL,         'SLA 90% — Critical Alert',                                                      'clickup',   NOW() - INTERVAL '18 hours'),

  -- Ticket 5 (resolved voice)
  (5, 'ticket_created',  'khalid.ahmed@iohealth.com',   'Khalid Ahmed',   NULL,         'Open',        'Payment gateway timeout during claim SAR 1,250. No charge made.',              'internal',  NOW() - INTERVAL '2 days'),
  (5, 'status_change',   'khalid.ahmed@iohealth.com',   'Khalid Ahmed',   'Open',       'Resolved',    NULL,                                                                            'internal',  NOW() - INTERVAL '1 day');

-- ─── SLA ALERTS ──────────────────────────────────────────────────────────────
INSERT INTO main.sla_alerts (ticket_id, alert_level, consumption_pct, notified_emails, notification_channel, is_acknowledged, created_at)
VALUES
  (2,  1, 65.0,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '3 hours'),
  (10, 1, 71.4,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '1 day'),
  (12, 2, 78.0,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '4 hours'),
  (12, 3, 87.5,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '2 hours'),
  (17, 1, 65.0,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', true,  NOW() - INTERVAL '22 hours'),
  (17, 2, 78.0,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', true,  NOW() - INTERVAL '21 hours'),
  (17, 3, 85.0,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '20 hours'),
  (17, 4, 100.0, ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '18 hours'),
  (18, 1, 65.0,  ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', true,  NOW() - INTERVAL '2 days 16 hours'),
  (18, 2, 100.0, ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '2 days'),
  (19, 1, 100.0, ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '4 days'),
  (20, 1, 100.0, ARRAY['ann.shruthy@iohealth.com','omer.shaikh@iohealth.com'], 'clickup', false, NOW() - INTERVAL '6 days');

-- ─── ESCALATION LEVEL UPDATES ────────────────────────────────────────────────
UPDATE main.tickets SET escalation_level = 2, last_escalation_at = NOW() - INTERVAL '2 hours'  WHERE id = 12;
UPDATE main.tickets SET escalation_level = 3, last_escalation_at = NOW() - INTERVAL '18 hours' WHERE id = 17;
UPDATE main.tickets SET escalation_level = 2, last_escalation_at = NOW() - INTERVAL '2 days'   WHERE id = 18;
UPDATE main.tickets SET escalation_level = 2, last_escalation_at = NOW() - INTERVAL '4 days'   WHERE id = 19;
UPDATE main.tickets SET escalation_level = 2, last_escalation_at = NOW() - INTERVAL '6 days'   WHERE id = 20;

-- ─── PROCESSING LOG ──────────────────────────────────────────────────────────
INSERT INTO main.processing_logs (workflow_name, entity_type, entity_id, action, status, details, created_at)
VALUES
  ('clickup-cortex-sync', 'workflow', NULL, 'sync_run', 'success',
   '{"tickets_processed": 0, "note": "Fresh seed — no prior sync runs"}'::jsonb,
   NOW());

-- =============================================================================
-- DONE.
-- Next steps:
-- 1. Run 01_curl_add_fields.sh and capture the response JSON for new field UUIDs
-- 2. Update the REPLACE_* placeholders in solution_custom_fields above with real UUIDs
-- 3. Re-run just the solution_custom_fields INSERT block (after truncating that table)
-- 4. For voice/apex tickets (ids 1-10): run workflow to push them to ClickUp
-- 5. Send test emails from @iohealth.com to trigger Zoho→ClickUp→DB flow
-- =============================================================================
