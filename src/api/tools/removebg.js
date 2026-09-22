const crypto = require("crypto");
const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");
const https = require("https");

const SERVERS = [
  "api1g", "api2g", "api3g", "api6g", "api8g", "api9g", "api10g", "api11g",
  "api12g", "api13g", "api14g", "api15g", "api16g", "api17g", "api18g",
  "api19g", "api20g", "api21g", "api22g", "api24g", "api25g"
];

function getImageDimensions(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
    throw new Error("Gagal membaca dimensi JPEG");
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    const format = buffer.toString("ascii", 12, 16);

    if (format === "VP8 ") {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }

    if (format === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }

    if (format === "VP8X") {
      const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
      const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
      return { width, height };
    }

    throw new Error("Format WebP tidak dikenali (bukan VP8/VP8L/VP8X)");
  }

  throw new Error("Format gambar tidak dikenali (hanya JPEG/PNG/WebP didukung)");
}

async function getToken() {
  const html = await axios.get("https://www.iloveimg.com/remove-background");
  const $ = cheerio.load(html.data);

  const script = $("script")
    .filter((_, el) => $(el).html()?.includes("ilovepdfConfig ="))
    .html();
  if (!script) throw new Error("Config tidak ditemukan");

  const jsonStr = script.split("var ilovepdfConfig = ")[1].split(";")[0];
  const json = JSON.parse(jsonStr);
  const csrf = $('meta[name="csrf-token"]').attr("content");

  const taskMatch = script.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/);
  const taskId = taskMatch ? taskMatch[1] : null;

  if (!json?.token || !csrf) throw new Error("Token/CSRF gagal diambil");
  if (!taskId) throw new Error("taskId tidak ditemukan di halaman");

  return { token: json.token, csrf, taskId, servers: json.servers || [] };
}

async function uploadImage(server, headers, buffer, filename, task) {
  const form = new FormData();
  form.append("task", task);
  form.append("file", buffer, filename);

  const res = await axios.post(`https://${server}.iloveimg.com/v1/upload`, form, {
    headers: { ...headers, ...form.getHeaders() }
  });
  return res.data;
}

async function removeBackgroundPreview(server, headers, task, serverFilename) {
  const form = new FormData();
  form.append("task", task);
  form.append("server_filename", serverFilename);

  const res = await axios.post(`https://${server}.iloveimg.com/v1/removebackground`, form, {
    headers: { ...headers, ...form.getHeaders() },
    responseType: "arraybuffer"
  });
  return res.data;
}

async function processFinal(server, headers, task, serverFilename, originalFilename, width, height) {
  const form = new FormData();
  form.append("packaged_filename", "iloveimg-background-removed");
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("task", task);
  form.append("tool", "removebackgroundimage");
  form.append("files[0][server_filename]", serverFilename);
  form.append("files[0][filename]", originalFilename);

  const res = await axios.post(`https://${server}.iloveimg.com/v1/process`, form, {
    headers: { ...headers, ...form.getHeaders() }
  });
  return res.data;
}

async function downloadResult(server, headers, task) {
  const res = await axios.get(`https://${server}.iloveimg.com/v1/download/${task}`, {
    headers,
    responseType: "arraybuffer"
  });
  return res.data;
}

async function removeBackground(buffer, filename) {
  const { width, height } = getImageDimensions(buffer);
  const { token, csrf, taskId, servers } = await getToken();
  const serverList = servers.length ? servers : SERVERS;
  const server = serverList[Math.floor(Math.random() * serverList.length)];

  const headers = {
    Authorization: "Bearer " + token,
    Origin: "https://www.iloveimg.com/",
    Cookie: "_csrf=" + csrf,
    "User-Agent": "Mozilla/5.0"
  };

  const upload = await uploadImage(server, headers, buffer, filename, taskId);
  await removeBackgroundPreview(server, headers, taskId, upload.server_filename);
  await processFinal(server, headers, taskId, upload.server_filename, filename, width, height);
  const resultBuffer = await downloadResult(server, headers, taskId);

  return { success: true, buffer: resultBuffer };
}

function randomFilename(ext = "png") {
  return `${crypto.randomBytes(8).toString("hex")}.${ext}`;
}

module.exports = function(app) {
    app.get('/tools/removebg', async (req, res) => {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ status: false, message: "Parameter 'url' is required (URL of the image)" });
        }

        try {
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imgBuffer = Buffer.from(imgRes.data);
            
            const filename = randomFilename("jpg");

            const { buffer: resultBuffer } = await removeBackground(imgBuffer, filename);
            
            const outFilename = randomFilename("png");
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', resultBuffer, { filename: outFilename });

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

        } catch (err) {
            console.error(err);
            const msg = err.response && err.response.data 
                ? (Buffer.isBuffer(err.response.data) ? err.response.data.toString() : JSON.stringify(err.response.data)) 
                : err.message;
            res.status(500).json({ status: false, message: msg });
        }
    });
};
