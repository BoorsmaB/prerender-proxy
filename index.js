const express = require("express");
const prerender = require("prerender-node");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();

// Add your prerender token here
prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);

app.use(prerender);

// Replace with your real frontend URL (hosted on Render)
const frontendUrl = "https://your-frontend-app.onrender.com";

app.use(
  "/",
  createProxyMiddleware({
    target: frontendUrl,
    changeOrigin: true,
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
