const https = require('https');
const crypto = require('crypto');

const APP_ID = 'PMZUYBQDAK';
const API_KEY = '24b09689d5b4223813d9b8e48563c8f6';
const AGENT_ID = 'ccdec697-e3fe-465b-a1c3-657e7bf18aef';
const AGENT_HOST = `${APP_ID.toLowerCase()}.algolia.net`;

function httpRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString('utf8')
                });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function agentChat(prompt) {
    const payload = JSON.stringify({
        id: crypto.randomBytes(8).toString('hex'),
        messages: [
            {
                role: 'user',
                parts: [{ type: 'text', text: prompt }],
                id: crypto.randomBytes(8).toString('hex')
            }
        ],
        algolia: {}
    });

    const requestPath = `/agent-studio/1/agents/${AGENT_ID}/completions?stream=true&compatibilityMode=ai-sdk-5`;

    const headers = {
        'Content-Type': 'application/json',
        'x-algolia-application-id': APP_ID,
        'x-algolia-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        'Accept': 'text/event-stream',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Origin': 'https://docsearch.algolia.com',
        'Referer': 'https://docsearch.algolia.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
    };

    const options = {
        hostname: AGENT_HOST,
        port: 443,
        path: requestPath,
        method: 'POST',
        headers
    };

    const res = await httpRequest(options, payload);

    if (res.statusCode !== 200) {
        throw new Error(`Agent chat gagal, status ${res.statusCode}: ${res.body.slice(0, 200)}`);
    }

    let answer = '';
    let suggestions = [];
    let messageId = null;
    let finishReason = null;

    const lines = res.body.split('\n');
    for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            continue;
        }

        if (data.type === 'start' && data.messageId) {
            messageId = data.messageId;
        } else if (data.type === 'text-delta' && data.delta) {
            answer += data.delta;
        } else if (data.type === 'data-suggestions' && data.data?.suggestions) {
            suggestions = data.data.suggestions;
        } else if (data.type === 'finish') {
            finishReason = data.finishReason || 'stop';
        }
    }

    answer = answer
        .replace(/\\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        message_id: messageId,
        prompt,
        answer: answer,
        suggestions,
        finish_reason: finishReason
    };
}

module.exports = function(app) {
    app.get('/ai/algolia', async (req, res) => {
        try {
            const { text } = req.query;
            if (!text) {
                return res.status(400).json({ status: false, error: 'Text is required' });
            }
            const data = await agentChat(text);
            res.status(200).json({
                status: true,
                result: data.answer
            });
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });
};
