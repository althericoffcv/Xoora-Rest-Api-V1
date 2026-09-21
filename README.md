# Rynn UI

> **This copy ships the XOORA frontend** (dashboard, docs and live status pages). See [XOORA frontend](#xoora-frontend) below. The original setup and `settings.json` reference still apply.

![Layout](https://files.catbox.moe/9qpys9.png)

Rynn UI is a simple and easy-to-use API documentation interface built with Express.js. It allows developers to quickly set up and view API documentation with customizable settings using a `settings.json` file. 

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/rynxzyy/Rynn-UI)

## Features
- Simple API documentation interface
- Easily customizable with a `settings.json` file
- Categorized APIs for easy navigation
- Includes real-time settings such as name, version, description, and creator
- Supports image display in the UI for branding
- Links to external resources such as source code and contact info

## Live Demo

Check out a live demo of Rynn UI [here](https://rynnn-ui.vercel.app)

## Setup

### Prerequisites
- Node.js (>= 14.0.0)

### Installation
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/RynnKunnn/Rynn-UI.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Rynn-UI
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Modify the `settings.json` file to configure your API documentation.
5. Start the server:
   ```bash
   npm start
   ```
Your API documentation should now be available at `http://localhost:<PORT>`.

## Customization

![Layout](https://files.catbox.moe/bjazqb.png)

You can easily customize the UI by editing the `settings.json` file. Below is a breakdown of the configurable fields:

### General Settings

- `name`: Sets the name of your API (e.g., "Rynn Api's").
- `version`: Specifies the version of your API interface (e.g., "Rynn UI").
- `description`: A brief description of your API documentation.

### Header Customization

- `status`: Indicates the current status of your API (e.g., "Online!").
- `imageSrc`: An array of image URLs to display in the header. Multiple images can be set for variety.
- `imageSize`: Defines responsive image sizes based on the device type:
  - `mobile`: Size for mobile devices (e.g., "80%").
  - `tablet`: Size for tablets (e.g., "40%").
  - `desktop`: Size for desktops (e.g., "40%").

### Api Settings

- `creator`: Displays the creator's name in the interface.

### Links

- `name`: Label for the link (e.g., "Source Code").
- `url`: The URL to the resource.

### Categories and Apis

Organize APIs into categories for better navigation:
- **Category Name (e.g., "AI (Artificial Intelligence)")**
  - `items`: Define individual APIs within the category.
    - `name`: The name of the API (e.g., "LuminAI").
    - `desc`: A short description of the API (e.g., "Talk with luminai").
    - `path`: The endpoint path for the API (e.g., /ai/luminai?text=).

### Example `settings.json`

Here’s an example of how your settings.json file might look:
```json
{
  "name": "Rynn Api's",
  "version": "Rynn UI",
  "description": "Simple and Easy-to-Use API Documentation",
  "header": {
    "status": "Online!",
    "imageSrc": [
      "https://media4.giphy.com/media/l0Iy33dWjmywkCnNS/giphy.gif?cid=6c09b952p3mt40j1mgznfi9rwwtccbjl7mtc2kvfugymeinr&ep=v1_internal_gif_by_id&rid=giphy.gif&ct=g"
    ],
    "imageSize": {
      "mobile": "80%",
      "tablet": "40%",
      "desktop": "40%"
    }
  },
  "apiSettings": {
    "creator": "Rynn"
  },
  "links": [
    {
      "name": "Source Code",
      "url": "https://github.com/rynxzyy/Rynn-UI"
    },
    {
      "name": "Contact Me",
      "url": "https://wa.me/6285173370004"
    }
  ],
  "categories": [
    {
      "name": "AI (Artificial Intelligence)",
      "items": [
        {
          "name": "LuminAI",
          "desc": "Talk with luminai",
          "path": "/ai/luminai?text="
        },
        {
          "name": "HydroMind",
          "desc": "Talk with hydromind",
          "path": "/ai/hydromind?text=&model=",
          "innerDesc": "See the list of supported AI models here: https://mind.hydrooo.web.id"
        }
      ]
    },
    {
      "name": "Random",
      "items": [
        {
          "name": "Blue Archive",
          "desc": "Blue Archive Random Images",
          "path": "/random/ba"
        }
      ]
    },
    {
      "name": "Search Tools",
      "items": [
        {
          "name": "YouTube",
          "desc": "Video search",
          "path": "/search/youtube?q="
        }
      ]
    }
  ]
}
```
This structure allows you to easily adapt and configure the interface to suit your API needs!

## XOORA frontend

The frontend is a light "anime sci-fi tech" design with three pages: `/` (dashboard), `/docs` and `/status`, plus restyled 404 and 500 pages. It is plain HTML, CSS and ES modules with **no build step**, so `npm start` and the Vercel deploy work as before.

### Structure

```
api-page/
  index.html  docs.html  status.html  404.html  500.html
  assets/css/    tokens.css (design tokens, light + dark) | layout.css | components.css | pages.css
  assets/js/
    core/         config (loads settings.json) | dom | icons | ui | format | snippets | highlight
                  runner | status-data | docs-model | demo (sample data)
    components/   layout (navbar, drawer, tab bar, footer) | hero | cards | code | playground | chart
                  docs | docs-content | search | status
    pages/        home.js | docs.js | status.js
src/system/telemetry.js   records API traffic and serves GET /system/status
```

### New optional `settings.json` fields

Everything below is optional and backwards compatible.

| Field | What it does |
| --- | --- |
| `site.title` | Title used by the UI |
| `site.baseUrl` | Base URL shown in code samples (defaults to the site's own origin), e.g. `https://api.example.com` |
| `site.assets` | `logo`, `favicon`, `hero`, `docsRobot`, `statusHealthy` image URLs |
| `auth.required` | `false` today. Set `true` (plus `header`, `scheme`, `keysUrl`, `signupUrl`) to switch the docs to an account / API key flow |
| `status.incidents` | Incidents shown on `/status` and in the bell menu: `{ id, title, impact: minor\|major\|critical, status, startedAt, resolvedAt?, updates: [{ at, message }] }` |
| category `icon` | Icon name from `assets/js/core/icons.js` |
| item `icon`, `method` | Card icon, HTTP method (default `GET`) |
| item `response` | Use `"image"` for endpoints that return an image |
| item `params` | `{ "text": { "description": "...", "example": "Hello", "required": true } }` |
| item `sample` | Fields merged into the example JSON response shown in the docs |

### Adding an API

1. Create `src/api/<category>/<name>.js` exactly as before (`module.exports = (app) => { ... }`).
2. Add its entry to `src/settings.json`.

It then appears on the dashboard, in the docs (with cURL / JavaScript / Python / Node.js snippets), in the search palette (Ctrl/Cmd + K) and on the status page.

### Live status and statistics

`GET /system/status` returns request counts, latency, error rate and per-route health, recorded by `src/system/telemetry.js`. The data lives in **server memory**, so it resets on restart and is per instance on serverless hosts. To make it durable, replace the two `Map`s in that file with a store such as Redis or Firestore; the response shape can stay the same.

Preview the status page with sample data at `/status?demo=1`.

### Images

Artwork is loaded from the URLs in `site.assets`. For the best performance, download the images into `api-page/assets/img/`, convert them to WebP, and point `site.assets` at `/assets/img/...`. The `<head>` of each page also contains a favicon, an Open Graph image and a preload hint for the hero art; update those if you change the artwork.

# Support

This project is designed to be easily deployable on various platforms. You can host it on any platform that supports Node.js applications. Some popular options include:

- **[Vercel](https://vercel.com/)**: Easy deployment with minimal configuration.
- **[Heroku](https://www.heroku.com/)**: A platform-as-a-service for deploying, managing, and scaling apps.
- **[Netlify](https://www.netlify.com/)**: A platform for deploying static sites and serverless functions.
- **[DigitalOcean](https://www.digitalocean.com/)**: Cloud infrastructure for deploying apps with more control over the environment.
- **[AWS](https://aws.amazon.com/)**: Amazon Web Services for scalable and customizable cloud hosting.
- **[Railway](https://railway.app/)**: A platform for deploying apps with easy integration and deployment steps.

Make sure your platform supports Node.js, and configure it to run your API according to the platform’s deployment guidelines.

If you need help with deployment, feel free to reach out to the creator or check the documentation of your chosen platform.
# Credits

This project is created and maintained by:

- **[Rynn](https://github.com/rynxzyy)**: Creator and main developer of the project.
- **[Lenwy](https://github.com/Lenwyy)**: For the inspiration behind the project.
- **[Siputzx](https://github.com/siputzx)**: For providing the LuminAI API.

Special thanks for the support and contributions throughout the development.

## License

This project is licensed under the [MIT License](LICENSE).
