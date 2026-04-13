require('dotenv').config();
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies — large limit to handle base64 image CVs
app.use(express.json({ limit: '20mb' }));

// ── API routes first (before static, so POST is never intercepted) ──
app.post('/api/analyse', async (req, res) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(500).json({ error: { message: 'GROQ_API_KEY is not set on the server.' } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000); // 30 s hard limit

  try {
    // Cap max_tokens at 1500 — enough for the report, avoids slow completions
    const body = { ...req.body, max_tokens: Math.min(req.body.max_tokens || 1500, 1500) };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const data = await groqRes.json();
    res.status(groqRes.status).json(data);
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    res.status(timedOut ? 504 : 500).json({
      error: { message: timedOut ? 'Request timed out — please try again.' : err.message }
    });
  } finally {
    clearTimeout(timer);
  }
});

// ── Serve static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// Root → serve the app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CV × JD running → http://localhost:${PORT}`);
});
