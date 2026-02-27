import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSchemaContext } from '@/lib/schema-context'

const MOCK_USER = {
  id: '13',
  email: 'omer.shaikh@iohealth.com',
  role: 'admin',
  display_name: 'Omer Shaikh',
  company_id: null,
}

// ─── Shared LLM caller ────────────────────────────────────────────────────────
async function callLLM(messages, temperature = 0.0, max_tokens = 600) {
  const response = await fetch('https://api.core42.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CORE42_API_KEY}`,
    },
    body: JSON.stringify({ model: 'gpt-4.1', temperature, max_tokens, messages }),
  })
  if (!response.ok) throw new Error(`Core42 API error: ${response.statusText}`)
  const data = await response.json()
  return data.choices[0].message.content?.trim() || ''
}

// ─── Agent 1: Orchestrator ────────────────────────────────────────────────────
// Decides if a DB query is needed and frames the task for the SQL Agent
async function orchestratorAgent(userMessage, conversationHistory, schemaContext) {
  const prompt = `You are the Cortex AI Orchestrator. You coordinate a team of agents to answer support operations questions.

DATABASE SCHEMA:
${schemaContext}

CONVERSATION HISTORY (last ${conversationHistory.length} messages):
${conversationHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

USER QUESTION: "${userMessage}"

RULES:
- If the question is about tickets, SLAs, escalations, counts, statuses, or any data — respond with: QUERY_NEEDED: <a clear 1-sentence description of what data to fetch>
- If the question is a greeting, thanks, or completely off-topic (not support ops) — respond with: NO_QUERY: <a short natural reply>
- If the question can be answered from conversation history alone — respond with: FROM_HISTORY: <answer directly>

Respond with ONLY one of the three formats above. Nothing else.`

  return callLLM([{ role: 'user', content: prompt }], 0.0, 150)
}

// ─── Agent 2: SQL Agent ───────────────────────────────────────────────────────
// Generates a safe PostgreSQL query
async function sqlAgent(taskDescription, userMessage, conversationHistory, schemaContext) {
  const prompt = `You are the Cortex SQL Agent. Your ONLY job is to write a single PostgreSQL query.

DATABASE SCHEMA:
${schemaContext}

CONVERSATION HISTORY:
${conversationHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

TASK: ${taskDescription}
USER QUESTION: "${userMessage}"

RULES:
- Write ONE complete SELECT query only (no INSERT/UPDATE/DELETE/DROP)
- Always filter: company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
- Always filter: (is_deleted = false OR is_deleted IS NULL)
- Use LOWER(status) for case-insensitive status comparisons
- Active/open statuses: 'open', 'in progress', 'waiting'
- Closed statuses: 'closed', 'resolved', 'complete', 'completed'
- Use LIMIT 15 for list queries
- Use JOINs only when needed for the answer
- Wrap your SQL in <sql>...</sql> tags

Output ONLY the <sql>...</sql> block. Nothing else.`

  return callLLM([{ role: 'user', content: prompt }], 0.0, 400)
}

// ─── Agent 3: Response Agent ──────────────────────────────────────────────────
// Converts raw DB results into a natural language answer
async function responseAgent(userMessage, queryResults, taskDescription) {
  const hasData = queryResults && queryResults.length > 0
  const prompt = `You are the Cortex Response Agent. Convert database results into a clear, concise answer.

USER QUESTION: "${userMessage}"
TASK THAT WAS EXECUTED: ${taskDescription}

DATABASE RESULTS:
${hasData ? JSON.stringify(queryResults, null, 2) : 'No data returned.'}

RULES:
1. Answer the question directly using ONLY the data above — never invent data
2. If no data: say "No [relevant items] found matching your query"
3. Be concise (2-5 sentences max for summaries, bullet list for multiple items)
4. Never show raw SQL, JSON brackets, or technical field names
5. For ticket lists: show ID, title, status, priority — one per line
6. Never say "Let me check", "One moment", "Fetching", or similar stall phrases

Provide your answer now:`

  return callLLM([{ role: 'user', content: prompt }], 0.1, 400)
}

// ─── Agent 4: Validator Agent ─────────────────────────────────────────────────
// Checks if the response actually answers the question
async function validatorAgent(userMessage, proposedAnswer, queryResults) {
  const prompt = `You are the Cortex Validator Agent. Verify that an answer correctly addresses the user's question.

USER QUESTION: "${userMessage}"
PROPOSED ANSWER: "${proposedAnswer}"
DATA USED: ${queryResults?.length > 0 ? `${queryResults.length} rows returned` : 'No data'}

CHECK:
1. Does the answer directly address what was asked? (YES/NO)
2. Does the answer contain any invented data not present in the results? (YES/NO — invented means hallucinated)
3. Is the answer complete enough to be useful? (YES/NO)

If ALL checks pass → respond: VALID
If any check fails → respond: REVISE: <specific 1-sentence instruction for what to fix>

Respond with ONLY "VALID" or "REVISE: <instruction>".`

  return callLLM([{ role: 'user', content: prompt }], 0.0, 80)
}

// ─── Main route handler ───────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { message } = await request.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    const { id: userId, role: userRole, company_id: userCompanyId, display_name: userName } = MOCK_USER
    const schemaContext = getSchemaContext(userRole, userCompanyId)

    // Load session
    const sessionResult = await pool.query(
      'SELECT messages, summary FROM test.ai_companion_sessions WHERE user_id = $1',
      [userId]
    )
    let messages = sessionResult.rows[0]?.messages || []
    let summary = sessionResult.rows[0]?.summary || null

    // Inject summary as context if exists
    const historyWithSummary = summary
      ? [{ role: 'system', content: `Previous conversation summary: ${summary}` }, ...messages.slice(-8)]
      : messages.slice(-8)

    // ── Stage 1: Orchestrator decides what to do ──────────────────────────────
    const orchestratorDecision = await orchestratorAgent(message, historyWithSummary, schemaContext)

    let finalReply

    if (orchestratorDecision.startsWith('NO_QUERY:')) {
      // Off-topic or greeting — reply directly
      finalReply = orchestratorDecision.replace('NO_QUERY:', '').trim()

    } else if (orchestratorDecision.startsWith('FROM_HISTORY:')) {
      // Can answer from conversation history
      finalReply = orchestratorDecision.replace('FROM_HISTORY:', '').trim()

    } else {
      // QUERY_NEEDED — run the full SQL → Response → Validate pipeline
      const taskDescription = orchestratorDecision.replace('QUERY_NEEDED:', '').trim()

      // ── Stage 2: SQL Agent generates query ───────────────────────────────────
      let sqlOutput = await sqlAgent(taskDescription, message, historyWithSummary, schemaContext)
      const sqlMatch = sqlOutput.match(/<sql>([\s\S]*?)<\/sql>/)

      let queryResults = []

      if (sqlMatch) {
        const rawSql = sqlMatch[1].trim()

        // Safety: reject any mutating SQL
        if (/^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)/i.test(rawSql)) {
          finalReply = 'I can only run read queries. Please ask a question about existing data.'
        } else {
          try {
            const dbResult = await pool.query(rawSql)
            queryResults = dbResult.rows
          } catch (dbErr) {
            // SQL Agent retry on error
            const retrySql = await sqlAgent(
              `${taskDescription}. Previous attempt failed with: ${dbErr.message}. Fix the query.`,
              message, historyWithSummary, schemaContext
            )
            const retryMatch = retrySql.match(/<sql>([\s\S]*?)<\/sql>/)
            if (retryMatch) {
              try {
                const retryResult = await pool.query(retryMatch[1].trim())
                queryResults = retryResult.rows
              } catch {
                queryResults = []
              }
            }
          }

          if (finalReply === undefined) {
            // ── Stage 3: Response Agent formats the answer ──────────────────────
            let draft = await responseAgent(message, queryResults, taskDescription)

            // ── Stage 4: Validator Agent checks the answer ──────────────────────
            const validation = await validatorAgent(message, draft, queryResults)

            if (validation.startsWith('REVISE:')) {
              const instruction = validation.replace('REVISE:', '').trim()
              // One revision pass
              draft = await responseAgent(
                `${message}\n\nRevision needed: ${instruction}`,
                queryResults,
                taskDescription
              )
            }

            finalReply = draft
          }
        }
      } else {
        // SQL agent failed to produce a query
        finalReply = 'I was unable to retrieve that data. Please try rephrasing your question.'
      }
    }

    // Clean up stall phrases
    const stallPhrases = [
      /\[Fetching.*?\]/gi, /Let me (?:check|find|retrieve|fetch|see).*?(?:\.|$)/gi,
      /One moment\.?/gi, /Executing.*?query/gi, /I'll (?:look|check|fetch).*?(?:\.|$)/gi,
    ]
    stallPhrases.forEach(p => { finalReply = finalReply.replace(p, '') })
    finalReply = finalReply.trim()
    if (!finalReply || finalReply.length < 3) finalReply = 'No data found for your query.'

    // Save to session
    messages.push({ role: 'user', content: message })
    messages.push({ role: 'assistant', content: finalReply })

    // Summarize when history gets long
    if (messages.length >= 12) {
      const summaryPrompt = `Summarize this support operations conversation in 3-5 sentences. Include: what was asked, key data points found, specific ticket IDs or issues, any follow-up context.\n\nConversation:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`
      summary = await callLLM([{ role: 'user', content: summaryPrompt }], 0.2, 200)
      messages = []
    }

    await upsertSession(pool, userId, messages, summary)
    return NextResponse.json({ reply: finalReply })

  } catch (e) {
    console.error('Companion chat error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function upsertSession(pool, userId, messages, summary) {
  await pool.query(`
    INSERT INTO test.ai_companion_sessions (user_id, messages, summary, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET messages = $2, summary = $3, updated_at = NOW()
  `, [userId, JSON.stringify(messages), summary])
}
