const express = require("express");
const prerender = require("prerender-node");
const http = require("http");
const https = require("https");
const { URL } = require("url");
require("dotenv").config();

const app = express();
const frontendUrl = "https://riffcrusher.com";
const targetUrl = new URL(frontendUrl);

// Configure prerender with token
prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve verification page for root URL bot requests
app.get("/", (req, res, next) => {
  const userAgent = req.get("User-Agent") || "";
  const isBot =
    userAgent.includes("Prerender") ||
    userAgent.includes("bot") ||
    userAgent.includes("crawler") ||
    req.query._escaped_fragment_ !== undefined;

  if (isBot) {
    console.log("🤖 Serving verification page");
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>RiffCrusher</title>
        <meta name="description" content="Guitar tab management platform">
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <div id="root">
          <h1>RiffCrusher</h1>
          <p>Guitar tab management platform.</p>
        </div>
      </body>
      </html>
    `);
  }
  next();
});

// Serve manifest.json
app.get("/manifest.json", (req, res) => {
  console.log("📄 Serving manifest.json");
  res.setHeader("Content-Type", "application/json");
  res.send({
    short_name: "RiffCrusher",
    name: "RiffCrusher - Guitar Tab Management",
    icons: [{ src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" }],
    start_url: "/",
    display: "standalone",
    theme_color: "#000000",
    background_color: "#ffffff",
  });
});

// Bypass prerender for static assets and API
app.use((req, res, next) => {
  if (
    req.url.match(
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|xml|txt|map)$/
    ) ||
    req.url.startsWith("/static/") ||
    req.url.startsWith("/assets/") ||
    req.url.startsWith("/api/")
  ) {
    console.log(`⏭️ Bypassing prerender for: ${req.url}`);
    return proxyRequest(req, res);
  }
  next();
});

// Apply prerender middleware
app.use(prerender);

// Proxy function
function proxyRequest(req, res) {
  const fullUrl = `${frontendUrl}${req.url}`;
  console.log(`📡 Proxying to: ${fullUrl}`);

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.protocol === "https:" ? 443 : 80,
    path: req.url,
    method: req.method,
    headers: {
      host: targetUrl.hostname,
      "user-agent": req.get("user-agent") || "PreRender-Proxy/1.0",
      accept: req.get("accept") || "*/*",
      "accept-encoding": req.get("accept-encoding") || "gzip, deflate, br",
    },
  };

  const client = targetUrl.protocol === "https:" ? https : http;

  const proxyReq = client.request(options, (proxyRes) => {
    res.statusCode = proxyRes.statusCode;

    // Forward headers and fix MIME types
    Object.keys(proxyRes.headers).forEach((key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        res.setHeader(key, proxyRes.headers[key]);
      }
    });

    if (
      !proxyRes.headers["content-type"] ||
      proxyRes.headers["content-type"] === "text/plain"
    ) {
      if (req.url.endsWith(".js"))
        res.setHeader("Content-Type", "application/javascript");
      else if (req.url.endsWith(".css"))
        res.setHeader("Content-Type", "text/css");
      else if (req.url.endsWith(".json"))
        res.setHeader("Content-Type", "application/json");
    }

    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`❌ Proxy error: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).send("Proxy Error");
    }
  });

  proxyReq.setTimeout(30000, () => {
    console.error(`⏰ Timeout: ${fullUrl}`);
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).send("Gateway Timeout");
  });

  if (["POST", "PUT", "PATCH"].includes(req.method)) req.pipe(proxyReq);
  else proxyReq.end();
}

// Catch-all route
app.use("*", proxyRequest);

// Error handling
app.use((err, req, res, next) => {
  console.error(`❌ Error: ${err.message}`);
  if (!res.headersSent)
    res.status(500).json({ error: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📍 Proxying to: ${frontendUrl}`);
});
