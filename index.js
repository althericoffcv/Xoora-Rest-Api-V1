const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

app.enable("trust proxy");
app.set("json spaces", 2);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
// HTML is always revalidated; other frontend assets get a short cache in production.
app.use('/', express.static(path.join(process.cwd(), 'api-page'), {
    setHeaders: (res, filePath) => {
        const cacheable = isProduction && !filePath.endsWith('.html');
        res.setHeader('Cache-Control', cacheable ? 'public, max-age=600, stale-while-revalidate=86400' : 'no-cache');
    }
}));
app.use('/src', express.static(path.join(process.cwd(), 'src')));

const settingsPath = path.join(process.cwd(), './src/settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
        if (data && typeof data === 'object') {
            const responseData = {
                status: data.status,
                creator: settings.apiSettings.creator || "Created Using Rynn UI",
                ...data
            };
            return originalJson.call(this, responseData);
        }
        return originalJson.call(this, data);
    };
    next();
});

// Request telemetry: records API traffic and serves GET /system/status (used by the /status page)
require('./src/system/telemetry')(app);

// Api Route
let totalRoutes = 0;
const apiFolder = path.join(process.cwd(), './src/api');
fs.readdirSync(apiFolder).forEach((subfolder) => {
    const subfolderPath = path.join(apiFolder, subfolder);
    if (fs.statSync(subfolderPath).isDirectory()) {
        fs.readdirSync(subfolderPath).forEach((file) => {
            const filePath = path.join(subfolderPath, file);
            if (path.extname(file) === '.js') {
                require(filePath)(app);
                totalRoutes++;
                console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Loaded Route: ${path.basename(file)} `));
            }
        });
    }
});
console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'api-page', 'index.html'));
});

// Frontend pages
app.get(['/docs', '/status'], (req, res) => {
    res.sendFile(path.join(process.cwd(), 'api-page', `${req.path.replace(/\//g, '')}.html`));
});

app.use((req, res, next) => {
    res.status(404).sendFile(path.join(process.cwd(), "api-page", "404.html"));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(process.cwd(), "api-page", "500.html"));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
    });
}

module.exports = app;
