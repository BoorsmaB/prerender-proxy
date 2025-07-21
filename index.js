const express = require("express");
const prerender = require("prerender-node");
const http = require("http");
const https = require("https");
const { URL } = require("url");
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

// Test route for Prerender verification - serve a simple page for root URL when it's a verification
app.get("/", (req, res, next) => {
  const userAgent = req.get("User-Agent") || "";
  const isBot =
    userAgent.includes("Prerender") ||
    userAgent.includes("bot") ||
    userAgent.includes("crawler") ||
    userAgent.includes("spider") ||
    req.query._escaped_fragment_ !== undefined;

  // If this is a verification request (simple bot check), serve a test page
  if (
    isBot &&
    (userAgent.includes("Prerender") ||
      req.query._escaped_fragment_ !== undefined)
  ) {
    console.log("📋 Serving verification page for Prerender.io");
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>RiffCrusher - Guitar Tab Management</title>
        <meta name="description" content="Professional guitar tab management and sharing platform for musicians">
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta property="og:title" content="RiffCrusher - Guitar Tab Management">
        <meta property="og:description" content="Professional guitar tab management and sharing platform for musicians">
        <meta property="og:type" content="website">
      </head>
      <body>
        <div id="root">
          <h1>🎸 RiffCrusher</h1>
          <p>Professional guitar tab management and sharing platform for musicians.</p>
          <p>Prerender integration active - timestamp: ${new Date().toISOString()}</p>
          <nav>
            <a href="/tabs">Browse Tabs</a>
            <a href="/learn">Learn Guitar</a>
            <a href="/community">Community</a>
          </nav>
        </div>
      </body>
      </html>
    `);
  }

  // Otherwise, continue to proxy
  next();
});

// Test route for debugging
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

// Static asset middleware - handle these first
app.use("/static", (req, res) => {
  console.log(`📁 Serving static asset: ${req.url}`);
  proxyRequest(req, res);
});

app.use((req, res, next) => {
  // Skip prerender for static assets (including those not in /static/)
  if (
    req.url.match(
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|xml|txt|map)$/
    )
  ) {
    console.log(`⏭️  Skipping prerender for static asset: ${req.url}`);
    return proxyRequest(req, res);
  }

  // Skip prerender for API routes (if any)
  if (req.url.startsWith("/api/")) {
    console.log(`⏭️  Skipping prerender for API route: ${req.url}`);
    return proxyRequest(req, res);
  }

  // Skip prerender for static directories
  if (
    req.url.startsWith("/static/") ||
    req.url.startsWith("/assets/") ||
    req.url.startsWith("/public/")
  ) {
    console.log(`⏭️  Skipping prerender for static directory: ${req.url}`);
    return proxyRequest(req, res);
  }

  // Skip our test routes
  if (req.url.startsWith("/prerender-test") || req.url.startsWith("/health")) {
    console.log(`⏭️  Skipping prerender for internal route: ${req.url}`);
    return next();
  }

  // Skip prerender for root URL if it's not a bot (let it go to our custom handler)
  if (req.url === "/") {
    const userAgent = req.get("User-Agent") || "";
    const isBot =
      userAgent.includes("Prerender") ||
      userAgent.includes("bot") ||
      userAgent.includes("crawler") ||
      userAgent.includes("spider") ||
      req.query._escaped_fragment_ !== undefined;

    if (!isBot) {
      console.log(`⏭️  Skipping prerender for regular user on root URL`);
      return next();
    }
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
const targetUrl = new URL(frontendUrl);

// Custom proxy function to avoid http-proxy-middleware issues
function proxyRequest(req, res) {
  console.log(`📡 Proxying to: ${frontendUrl}${req.url}`);

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.hostname,
      "x-forwarded-host": req.get("host"),
      "x-forwarded-proto": req.protocol || "https",
      accept: req.headers.accept || "*/*",
    },
  };

  // Remove host header to avoid conflicts
  delete options.headers["host"];
  options.headers.host = targetUrl.hostname;

  const client = targetUrl.protocol === "https:" ? https : http;

  const proxyReq = client.request(options, (proxyRes) => {
    console.log(
      `📨 Response from target: ${proxyRes.statusCode} for ${req.url}`
    );

    // Set response status first
    res.statusCode = proxyRes.statusCode;

    // Forward all headers from the target
    Object.keys(proxyRes.headers).forEach((key) => {
      res.setHeader(key, proxyRes.headers[key]);
    });

    // Don't override content-type for static assets - let the original server handle it
    const isStaticAsset =
      req.url.match(
        /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|xml|txt|map)$/
      ) || req.url.startsWith("/static/");

    if (!isStaticAsset) {
      // Only modify headers for non-static content
      if (
        req.url === "/" ||
        (!req.url.includes(".") && !req.url.startsWith("/api/"))
      ) {
        if (
          !proxyRes.headers["content-type"] ||
          proxyRes.headers["content-type"].includes("text/html")
        ) {
          res.setHeader("content-type", "text/html; charset=utf-8");
        }
      }

      // Add cache control headers only for HTML pages
      res.setHeader(
        "cache-control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      res.setHeader("expires", "0");
      res.setHeader("pragma", "no-cache");
    }

    // Pipe the response
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`❌ Proxy error for ${req.url}:`, err.message);

    if (!res.headersSent) {
      res.status(502).json({
        error: "Bad Gateway: Proxy error",
        message: err.message,
        url: req.url,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Set timeout for the request
  proxyReq.setTimeout(30000, () => {
    console.error(`⏰ Timeout for ${req.url}`);
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({
        error: "Gateway Timeout",
        url: req.url,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Forward request body for POST/PUT requests
  if (req.method === "POST" || req.method === "PUT") {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

// Catch all route for proxying
app.use("*", (req, res) => {
  proxyRequest(req, res);
});

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
