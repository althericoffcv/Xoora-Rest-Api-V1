const axios = require('axios');
const FormData = require('form-data');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const https = require('https');

const BASE_URL = 'https://www.ilovepdf.com';
const API_BASE = 'https://api31.ilovepdf.com/v1';

const TOKEN_PATTERNS = [
    /"token"\s*:\s*"(eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})"/,
    /'token'\s*:\s*'(eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})'/,
    /Bearer\s+(eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})/,
    /(eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{30,}\.[A-Za-z0-9_\-]{10,})/,
];

function extractToken(text) {
    if (!text) return null;
    for (const re of TOKEN_PATTERNS) {
        const m = text.match(re);
        if (m) return 'Bearer ' + m[1];
    }
    return null;
}

function makeTaskId(length = 110) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = function(app) {
    app.get('/tools/jpg2pdf', async (req, res) => {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ status: false, message: "Parameter 'url' is required (URL of the JPG image)" });
        }

        try {
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imgBuffer = Buffer.from(imgRes.data);
            const filename = 'image_' + Date.now() + '.jpg';
            const outputFilename = filename.replace(/\.[^.]+$/, '.pdf');

            const jar = new CookieJar();
            const client = wrapper(axios.create({ jar, withCredentials: true, maxBodyLength: Infinity, timeout: 120000 }));
            const plainAxios = axios.create({ timeout: 60000 });
            
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            };

            let authorization = '';
            const htmlRes = await plainAxios.get(`${BASE_URL}/jpg_to_pdf`, { headers });
            let token = extractToken(htmlRes.data);
            
            if (token) {
                authorization = token;
            } else {
                const scriptUrls = new Set();
                for (const m of htmlRes.data.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
                    let src = m[1];
                    if (src.startsWith('//')) src = 'https:' + src;
                    else if (src.startsWith('/')) src = BASE_URL + src;
                    scriptUrls.add(src);
                }
                for (const url of scriptUrls) {
                    try {
                        const r = await plainAxios.get(url, { headers: { ...headers, 'Accept': '*/*' } });
                        token = extractToken(r.data);
                        if (token) {
                            authorization = token;
                            break;
                        }
                    } catch (_) { }
                }
            }

            if (!authorization) {
                throw new Error('Gagal mendapatkan token auth.');
            }

            await client.get(`${BASE_URL}/jpg_to_pdf`, { headers });

            const task = makeTaskId();

            const uploadForm = new FormData();
            uploadForm.append('file', imgBuffer, { filename, contentType: 'image/jpeg' });
            uploadForm.append('task', task);

            const uploadRes = await client.post(`${API_BASE}/upload`, uploadForm, {
                headers: {
                    ...uploadForm.getHeaders(),
                    'Authorization': authorization,
                    'Accept': 'application/json',
                    'Origin': BASE_URL,
                    'Referer': `${BASE_URL}/jpg_to_pdf`,
                },
            });

            const serverFilename = uploadRes.data.server_filename;
            if (!serverFilename) throw new Error('Upload gagal: server_filename tidak ada');

            const files = [{ server_filename: serverFilename, filename: filename, rotate: 0 }];
            
            async function getTaskStatus(t) {
                const r = await client.get(`${API_BASE}/task/${t}`, {
                    headers: {
                        'Authorization': authorization,
                        'Accept': 'application/json',
                        'Origin': BASE_URL,
                        'Referer': `${BASE_URL}/jpg_to_pdf`,
                    },
                });
                return r.data;
            }

            let success = false;
            try {
                const payload = { files, tool: 'imagepdf', task, output_filename: outputFilename };
                const processRes = await client.post(`${API_BASE}/process`, payload, {
                    headers: {
                        'Authorization': authorization,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Origin': BASE_URL,
                        'Referer': `${BASE_URL}/jpg_to_pdf`,
                    },
                });
                if (processRes.data.status === 'TaskSuccess') success = true;
            } catch (err) {
                for (let attempt = 1; attempt <= 5; attempt++) {
                    try {
                        const form = new FormData();
                        form.append('files', JSON.stringify(files));
                        form.append('tool', 'imagepdf');
                        form.append('task', task);
                        form.append('output_filename', outputFilename);

                        const pRes = await client.post(`${API_BASE}/process`, form, {
                            headers: {
                                ...form.getHeaders(),
                                'Authorization': authorization,
                                'Accept': 'application/json',
                                'Origin': BASE_URL,
                                'Referer': `${BASE_URL}/jpg_to_pdf`,
                            },
                        });
                        if (pRes.data.status === 'TaskSuccess') { success = true; break; }
                    } catch (e) {
                        if (e.response && e.response.status === 400) {
                            const data = e.response.data;
                            if (data.error && data.error.param && data.error.param.files && data.error.param.files.includes('Files cannot be blank.')) {
                                await sleep(2000);
                                continue;
                            } else if (data.error && data.error.param && data.error.param.task && data.error.param.task.some(msg => msg.includes('currently processing'))) {
                                let statusData;
                                for (let i = 0; i < 20; i++) {
                                    statusData = await getTaskStatus(task);
                                    if (statusData.status === 'TaskSuccess') { success = true; break; }
                                    if (statusData.status === 'TaskFailed' || statusData.status === 'TaskError') throw new Error('Task gagal');
                                    await sleep(2000);
                                }
                                if (success) break;
                                throw new Error('Task tidak selesai');
                            }
                        }
                        throw e;
                    }
                }
            }

            if (!success) throw new Error('Proses konversi gagal');

            const dlRes = await client.get(`${API_BASE}/download/${task}`, {
                responseType: 'arraybuffer',
                headers: {
                    'Authorization': authorization,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Origin': BASE_URL,
                    'Referer': `${BASE_URL}/jpg_to_pdf`,
                },
            });

            const pdfBuf = Buffer.from(dlRes.data);
            if (pdfBuf.slice(0, 5).toString() !== '%PDF-') throw new Error('Hasil unduhan bukan PDF');

            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', pdfBuf, { filename: outputFilename });

            const uploadResCatbox = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: form.getHeaders(),
                timeout: 30000,
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            });

            res.json({
                status: true,
                author: "Bayu Official",
                download: uploadResCatbox.data.trim()
            });

        } catch (error) {
            console.error(error);
            const msg = error.response ? JSON.stringify(error.response.data) : error.message;
            res.status(500).json({ status: false, message: msg });
        }
    });
};
