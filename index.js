const express = require("express");
const prerender = require("prerender-node");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();

const frontendUrl = "https://riffcrusher.com";

// Configure Prerender
prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);
prerender.set("prerenderServiceUrl", "https://service.prerender.io");
prerender.set("host", "riffcrusher.com");

// Use Prerender middleware (will only trigger for bots)
app.use(prerender);

// Proxy all requests to the main React app
app.use(
  "/",
  createProxyMiddleware({
    target: frontendUrl,
    changeOrigin: true,
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
