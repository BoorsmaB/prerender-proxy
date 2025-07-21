const express = require("express");
const prerender = require("prerender-node");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();

prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);

// Only apply prerender middleware for HTML pages (not for static files)
app.use((req, res, next) => {
  // Skip prerender for static assets (like .css, .js, images)
  if (
    req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
  ) {
    return next();
  }
  return prerender(req, res, next);
});

const frontendUrl = "https://riffcrusher.com";

app.use(
  "/",
  createProxyMiddleware({
    target: frontendUrl,
    changeOrigin: true,
    onProxyRes: (proxyRes, req, res) => {
      // Optionally tweak headers if needed
      proxyRes.headers["cache-control"] =
        "no-store, no-cache, must-revalidate, proxy-revalidate";
      proxyRes.headers["expires"] = "0";
      proxyRes.headers["pragma"] = "no-cache";
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err.message);
      res.status(502).send("Bad Gateway: Proxy error");
    },
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
