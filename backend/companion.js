import express from 'express';
import fetch from 'node-fetch';
import { getSchemaContext } from './schema-context.js';

export default function companionRoutes(pool) {
  const router = express.Router();

  // Temporary: Mock user for testing (remove when auth is ready)
  router.use((req, res, next) => {
    req.user = {
      id: '13',
      email: 'omer.shaikh@iohealth.com',
      role: 'admin',
      role_name: 'Project Manager (Test)',
      display_name: 'Omer Shaikh',
      company_id: null
    };
    next();
  });

  // POST /api/companion/chat
  router.post('/chat', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

      const userId = req.user.id;
      const userRole = req.user.role || 'admin';
      const userCompanyId = req.user.company_id;
      const userName = req.user.display_name || req.user.email;

      // 1. Load or create session
      let sessionResult = await pool.query(
        'SELECT messages, summary FROM test.ai_companion_sessions WHERE user_id = $1',
        [userId]
      );
      let messages = sessionResult.rows[0]?.messages || [];
      let summary = sessionResult.rows[0]?.summary || null;

      // 2. Get schema context
      const schemaContext = getSchemaContext(userRole, userCompanyId);

      // 3. Build system prompt for SQL generation
      const systemPrompt = `You are Cortex AI, a support operations assistant with database access.

⚠️ CRITICAL RULE: You MUST generate a SQL query for EVERY question about tickets, counts, statuses, or data.
⚠️ You have NO memory of ticket data. ALL answers must come from database queries.
⚠️ If you answer without generating <sql>...</sql> tags, your response will be rejected.

CAPABILITIES:
- Answer questions about tickets, SLAs, escalations, team workload
- Generate PostgreSQL queries to fetch required data
- Analyze results and provide concise answers

SCOPE: Support operations ONLY. For anything else, say: "I can only help with support operations — tickets, SLAs, and escalations."

USER CONTEXT:
- Name: ${userName}
- Role: ${userRole}
- Timestamp: ${new Date().toISOString()}

${schemaContext}

WORKFLOW:
1. Understand user question - check conversation history for context
2. Generate minimal SQL query - only fetch what's needed
3. Wrap query in <sql>...</sql> tags
4. After execution, provide natural answer WITHOUT showing the SQL

QUERY OPTIMIZATION RULES:
- Use WHERE clause filters before JOINs when possible
- Only JOIN tables if you need columns from them
- Use LIMIT to restrict result sets (default 10 for lists)
- For counts, use COUNT(*) without unnecessary columns
- Remember conversation context - if user says "ticket 360" then "what did customer say", you know which ticket
- CRITICAL: status 'complete', 'Resolved', 'Closed' are ALL closed statuses
- CRITICAL: Only 'Open', 'In Progress', 'Waiting' count as active/open tickets
- CRITICAL: Write ONE query that answers the question completely - do NOT break into multiple steps
- CRITICAL: Use subqueries or JOINs to resolve ticket titles to IDs in the SAME query

CONTEXT MEMORY:
- When user mentions a ticket by title (e.g., "ticketNo-360"), remember they mean that ticket
- When user asks "tell me about ticket X", save that ticket_id for follow-ups
- "What did customer say" = query threads table for last ticket discussed

FORBIDDEN PHRASES - NEVER use:
- "Let me check"
- "One moment"
- "Fetching data"
- "Executing the query"
- "Hold on"

You have INSTANT access to data. Just answer directly.

${summary ? `\nPREVIOUS CONVERSATION:\n${summary}` : ''}

Examples:
Q: "How many active tickets?"
SQL: <sql>SELECT COUNT(*) FROM test.tickets WHERE is_deleted=FALSE AND status NOT IN ('Closed','Resolved','complete')</sql>
Response: "31 active tickets"

Q: "How many comments does ticketNo-364 have?"
SQL: <sql>SELECT COUNT(*) as count FROM test.threads th JOIN test.tickets t ON th.ticket_id = t.id WHERE t.title = 'ticketNo-364' AND th.action_type = 'comment'</sql>
Response: "TicketNo-364 has 7 comments"

Q: "Show me P1 tickets"
SQL: <sql>SELECT id, title, status, sla_status FROM test.tickets WHERE priority='P1' AND is_deleted=FALSE LIMIT 10</sql>
Response: "8 P1 tickets: [list with IDs and titles]"

Q: "Tell me about ticketNo-360"
SQL: <sql>SELECT * FROM test.tickets WHERE title='ticketNo-360' AND is_deleted=FALSE</sql>
[Remember: user is now talking about ticket ID from result]
Response: "[Details about the ticket]"

Q: "What did customer say?"
[Context: Previous question was about ticketNo-360, so ticket_id = 139]
SQL: <sql>SELECT raw_content, actor_name, created_at FROM test.threads WHERE ticket_id=139 AND action_type='comment' ORDER BY created_at DESC LIMIT 5</sql>
Response: "[Summary of recent comments]"
`;

      // 4. Append user message
      messages.push({ role: 'user', content: message });
      messages = messages.slice(-20); // Keep last 20

      // 5. First LLM call - generate SQL or answer directly
      let llmMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const firstResponse = await fetch('https://api.core42.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CORE42_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          temperature: 0.0,
          messages: llmMessages
        })
      });

      if (!firstResponse.ok) {
        throw new Error(`Core42 API error: ${firstResponse.statusText}`);
      }

      const firstData = await firstResponse.json();
      let assistantReply = firstData.choices[0].message.content;

// 6. VALIDATION - Check if SQL query was generated
const sqlMatch = assistantReply.match(/<sql>([\s\S]*?)<\/sql>/);

// If no SQL generated for a data question, reject and return error
if (!sqlMatch) {
  const dataKeywords = ['how many', 'show me', 'list', 'what', 'which', 'tell me about', 'ticket', 'count', 'status', 'company', 'escalat'];
  const isDataQuestion = dataKeywords.some(kw => message.toLowerCase().includes(kw));
  
  if (isDataQuestion) {
    console.warn('⚠️ LLM did not generate SQL for data question:', message);
    messages.push({ role: 'assistant', content: 'I need to query the database for that information. Let me try again.' });
    
    await pool.query(`
      INSERT INTO test.ai_companion_sessions (user_id, messages, summary, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET messages = $2, summary = $3, updated_at = NOW()
    `, [userId, JSON.stringify(messages), summary]);
    
    return res.json({ reply: 'I need to query the database for that information. Please try rephrasing your question.' });
  }
  
  // Non-data question (like greetings) - return as-is
  messages.push({ role: 'assistant', content: assistantReply });
  
  await pool.query(`
    INSERT INTO test.ai_companion_sessions (user_id, messages, summary, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET messages = $2, summary = $3, updated_at = NOW()
  `, [userId, JSON.stringify(messages), summary]);
  
  return res.json({ reply: assistantReply });
}

// 7. SQL was generated - continue with execution
if (sqlMatch) {
        const sqlQuery = sqlMatch[1].trim();
        
        // Execute the generated SQL
        let queryResult;
        try {
          queryResult = await pool.query(sqlQuery);
          
          console.log('📊 SQL Query:', sqlQuery);
          console.log('📊 Results:', JSON.stringify(queryResult.rows, null, 2));

          // Check if query was incomplete (only returned ID when user asked for details)
          const isIdOnlyResult = queryResult.rows.length === 1 
            && queryResult.rows[0].id 
            && Object.keys(queryResult.rows[0]).length === 1;

          const needsDetails = message.toLowerCase().match(/comment|thread|detail|status|about|show me|tell me/);

          if (isIdOnlyResult && needsDetails) {
            console.log('⚠️ Incomplete query detected - retrying with ticket ID');
            
            const ticketId = queryResult.rows[0].id;
            
            messages.push({
              role: 'assistant',
              content: `Found ticket ID ${ticketId}. Now generating query for the requested details.`
            });
            
            messages.push({
              role: 'user',
              content: `The ticket ID is ${ticketId}. Now write ONE complete SQL query to answer: "${message}"`
            });

            const retryResponse = await fetch('https://api.core42.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CORE42_API_KEY}`
              },
              body: JSON.stringify({
                model: 'gpt-4.1',
                temperature: 0.05,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...messages
                ]
              })
            });

            const retryData = await retryResponse.json();
            const retrySqlMatch = retryData.choices[0].message.content.match(/<sql>([\s\S]*?)<\/sql>/);
            
            if (retrySqlMatch) {
              const retryQuery = retrySqlMatch[1].trim();
              console.log('📊 Retry SQL Query:', retryQuery);
              queryResult = await pool.query(retryQuery);
              console.log('📊 Retry Results:', JSON.stringify(queryResult.rows, null, 2));
            }
          }

        } catch (dbError) {
          // If SQL fails, ask LLM to fix it
          messages.push({ 
            role: 'assistant', 
            content: `Generated query had error: ${dbError.message}\nQuery was: ${sqlQuery}` 
          });
          messages.push({ 
            role: 'user', 
            content: 'The query failed. Please fix it and try again.' 
          });

          const retryResponse = await fetch('https://api.core42.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CORE42_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4.1',
              temperature: 0.05,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages
              ]
            })
          });

          const retryData = await retryResponse.json();
          assistantReply = retryData.choices[0].message.content;
          
          const retrySqlMatch = assistantReply.match(/<sql>([\s\S]*?)<\/sql>/);
          if (retrySqlMatch) {
            queryResult = await pool.query(retrySqlMatch[1].trim());
          } else {
            throw new Error('Failed to generate valid SQL query');
          }
        }

        // 7. Process results and generate final response
        const finalPrompt = `You are answering a question about support tickets.

USER QUESTION: "${message}"

DATABASE RESULTS:
${queryResult.rows.length === 0 
  ? 'No data was returned from the database.' 
  : JSON.stringify(queryResult.rows, null, 2)
}

INSTRUCTIONS:
1. Answer the question directly using ONLY the data above
2. If no data (0 rows): say "No [tickets/data] found" or "That doesn't exist"
3. Use natural language, be concise
4. Do NOT show SQL, JSON, or technical details
5. Do NOT say "Let me check" or "One moment"
6. Do NOT invent ticket IDs, titles, or any data not shown above

${queryResult.rows.length === 0 ? 'Since there is no data, tell the user nothing was found.' : ''}

Now provide your answer:`;

        const finalResponse = await fetch('https://api.core42.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CORE42_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            temperature: 0.0,
            max_tokens: 300,
            messages: [
              { role: 'user', content: finalPrompt }
            ]
          })
        });

        const finalData = await finalResponse.json();
        assistantReply = finalData.choices[0].message.content;

        // Aggressive cleanup of any leaked internal content
        const forbiddenPatterns = [
          /CRITICAL.*?$/gim,
          /DATABASE.*?$/gim,
          /STRICT RULES.*?$/gim,
          /RESULTS \(\d+ rows\).*?$/gim,
          /\[Fetching.*?\]/gi,
          /Let me (?:check|find|retrieve|fetch|see).*?(?:\.|$)/gi,
          /One moment\.?/gi,
          /Executing.*?query/gi
        ];

        forbiddenPatterns.forEach(pattern => {
          assistantReply = assistantReply.replace(pattern, '');
        });

        assistantReply = assistantReply.trim();

        // If response is now empty or too short, provide default
        if (!assistantReply || assistantReply.length < 5) {
          assistantReply = queryResult && queryResult.rows.length > 0
            ? `Found ${queryResult.rows.length} result(s).`
            : 'No data found.';
        }

        // Validation: Check for hallucinated IDs
        if (queryResult && queryResult.rows.length > 0) {
            const resultIds = new Set(
              queryResult.rows.flatMap(r => 
                [r.id, r.ticket_id, r.ticketId, r.ticketid].filter(Boolean).map(String)
              )
            );
            
            // If no IDs in result set, skip validation (e.g., COUNT queries, status-only queries)
            if (resultIds.size === 0) {
              // Skip validation for queries that don't return IDs
            } else {
              // Extract ticket IDs mentioned in response
              const mentionedIds = [...assistantReply.matchAll(/(?:Ticket\s*(?:ID)?|ID)\s*:?\s*(\d+)/gi)]
                .map(m => m[1]);
              
              const hallucinated = mentionedIds.filter(id => !resultIds.has(id));
              
              if (hallucinated.length > 0) {
                console.warn('⚠️ Hallucinated IDs:', hallucinated, 'Valid IDs:', Array.from(resultIds));
                
                if (queryResult.rows.length === 1 && queryResult.rows[0].count !== undefined) {
                  assistantReply = `${queryResult.rows[0].count} found.`;
                } else {
                  assistantReply = `Found ${queryResult.rows.length} result(s). Please ask me to show specific details.`;
                }
              }
            }
          }}

      // 8. Append final assistant response
      messages.push({ role: 'assistant', content: assistantReply });

      // 9. Handle summarization if needed
      if (messages.length >= 10) {
        const summaryPrompt = `Summarize this support operations conversation in 3-5 sentences.
Capture: what was asked, key data points mentioned, any specific tickets or issues, any follow-ups noted.
Be factual and brief. No fluff.

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

        const summaryResponse = await fetch('https://api.core42.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CORE42_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            temperature: 0.2,
            messages: [{ role: 'user', content: summaryPrompt }]
          })
        });

        const summaryData = await summaryResponse.json();
        summary = summaryData.choices[0].message.content;
        messages = []; // Reset messages after summary
      }

      // 10. Upsert session
      await pool.query(`
        INSERT INTO test.ai_companion_sessions (user_id, messages, summary, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET messages = $2, summary = $3, updated_at = NOW()
      `, [userId, JSON.stringify(messages), summary]);

      return res.json({ reply: assistantReply });

    } catch (error) {
      console.error('Companion chat error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/companion/clear
  router.post('/clear', async (req, res) => {
    try {
      await pool.query(
        `UPDATE test.ai_companion_sessions 
         SET messages = '[]'::jsonb, summary = NULL, updated_at = NOW() 
         WHERE user_id = $1`,
        [req.user.id]
      );
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/companion/history
  router.get('/history', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT messages, summary FROM test.ai_companion_sessions WHERE user_id = $1',
        [req.user.id]
      );
      
      if (result.rows.length === 0) {
        return res.json({ messages: [], summary: null });
      }

      return res.json({
        messages: result.rows[0].messages || [],
        summary: result.rows[0].summary
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}