const express = require("express");
const prerender = require("prerender-node");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();

// Add your prerender token here
prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);

// Use prerender middleware to serve bots/crawlers prerendered HTML
app.use(prerender);

// Replace with your real frontend URL (hosted on Render)
const frontendUrl = "https://riffcrusher.com";

app.use(
  "/",
  createProxyMiddleware({
    target: frontendUrl,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      console.log(
        `Proxying request: ${req.method} ${req.url} --> ${frontendUrl}${req.url}`
      );
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err.message);
      res.status(502).send("Bad Gateway: Proxy error");
    },
  })
);

// Use the port from Render's environment or fallback to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
