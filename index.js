const express = require("express");
const prerender = require("prerender-node");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();

// Configure prerender with token
prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);

// Add logging middleware for debugging
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] Request: ${req.method} ${req.url}`
  );
  console.log(`User-Agent: ${req.get("User-Agent") || "Not provided"}`);

  // Log if this looks like a bot request
  const userAgent = req.get("User-Agent") || "";
  const isBot =
    userAgent.includes("Prerender") ||
    userAgent.includes("bot") ||
    userAgent.includes("crawler") ||
    req.query._escaped_fragment_ !== undefined;

  if (isBot) {
    console.log("🤖 Bot detected - will prerender");
  }

  next();
});

// Test route for Prerender verification
app.get("/prerender-test", (req, res) => {
  console.log("📋 Serving prerender test page");
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Prerender Test Page - RiffCrusher</title>
      <meta name="description" content="Test page for Prerender verification - RiffCrusher integration working">
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body>
      <h1>✅ Prerender Integration Working</h1>
      <p>This page confirms Prerender.io integration is functional for RiffCrusher.</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
      <p>User-Agent: ${req.get("User-Agent") || "Not provided"}</p>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    env: {
      port: process.env.PORT || 3000,
      hasToken: !!process.env.PRERENDER_TOKEN,
    },
  });
});

// Prerender middleware - only for HTML pages
app.use((req, res, next) => {
  // Skip prerender for static assets
  if (
    req.url.match(
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|xml|txt)$/
    )
  ) {
    console.log(`⏭️  Skipping prerender for static asset: ${req.url}`);
    return next();
  }

  // Skip prerender for API routes (if any)
  if (req.url.startsWith("/api/")) {
    console.log(`⏭️  Skipping prerender for API route: ${req.url}`);
    return next();
  }

  // Skip our test routes
  if (req.url.startsWith("/prerender-test") || req.url.startsWith("/health")) {
    console.log(`⏭️  Skipping prerender for internal route: ${req.url}`);
    return next();
  }

  const userAgent = req.get("User-Agent") || "";
  const isBot =
    userAgent.includes("Prerender") ||
    userAgent.includes("bot") ||
    userAgent.includes("crawler") ||
    userAgent.includes("spider") ||
    req.query._escaped_fragment_ !== undefined;

  if (isBot) {
    console.log(`🔄 Processing bot request with prerender: ${req.url}`);
  }

  return prerender(req, res, next);
});

const frontendUrl = "https://riffcrusher.com";

// Proxy middleware to forward requests to your React app
app.use(
  "/",
  createProxyMiddleware({
    target: frontendUrl,
    changeOrigin: true,
    secure: true,
    followRedirects: true,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`📡 Proxying to: ${frontendUrl}${req.url}`);

      // Ensure proper headers are forwarded
      proxyReq.setHeader(
        "Accept",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      );

      // Forward original host and protocol info
      proxyReq.setHeader("X-Forwarded-Host", req.get("host"));
      proxyReq.setHeader("X-Forwarded-Proto", req.protocol);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(
        `📨 Response from target: ${proxyRes.statusCode} for ${req.url}`
      );

      // Ensure HTML content type for HTML responses
      if (
        req.url === "/" ||
        (!req.url.includes(".") && !req.url.startsWith("/api/"))
      ) {
        if (
          !proxyRes.headers["content-type"] ||
          proxyRes.headers["content-type"].includes("text/html")
        ) {
          proxyRes.headers["content-type"] = "text/html; charset=utf-8";
        }
      }

      // Add cache control headers
      proxyRes.headers["cache-control"] =
        "no-store, no-cache, must-revalidate, proxy-revalidate";
      proxyRes.headers["expires"] = "0";
      proxyRes.headers["pragma"] = "no-cache";

      // Add CORS headers if needed
      proxyRes.headers["Access-Control-Allow-Origin"] = "*";
      proxyRes.headers["Access-Control-Allow-Methods"] =
        "GET, POST, PUT, DELETE, OPTIONS";
      proxyRes.headers["Access-Control-Allow-Headers"] =
        "Content-Type, Authorization";
    },
    onError: (err, req, res) => {
      console.error(`❌ Proxy error for ${req.url}:`, err.message);

      if (!res.headersSent) {
        res.status(502).json({
          error: "Bad Gateway: Proxy error",
          message: err.message,
          url: req.url,
          timestamp: new Date().toISOString(),
        });
      }
    },
  })
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Application error:", err);

  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 404 handler
app.use("*", (req, res) => {
  console.log(`❓ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Not Found",
    url: req.url,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📍 Proxying requests to: ${frontendUrl}`);
  console.log(
    `🔑 Prerender token configured: ${
      process.env.PRERENDER_TOKEN ? "Yes" : "No"
    }`
  );
  console.log(`🧪 Test endpoints:`);
  console.log(`   - Health check: http://localhost:${PORT}/health`);
  console.log(`   - Prerender test: http://localhost:${PORT}/prerender-test`);
  console.log(`   - Main app: http://localhost:${PORT}/`);
});
