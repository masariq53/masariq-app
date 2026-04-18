const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Web alias: replace react-native-maps with a mock on web
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      filePath: path.resolve(__dirname, "mocks/react-native-maps.tsx"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Proxy /api requests from Metro (8081) to API server (3000)
// This allows the admin panel and web app to work from mobile browsers
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url.startsWith("/api/") || req.url.startsWith("/api")) {
      const http = require("http");
      const apiPort = process.env.API_PORT || 3000;
      const options = {
        hostname: "127.0.0.1",
        port: apiPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${apiPort}` },
      };
      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });
      proxyReq.on("error", (err) => {
        console.error("[Metro Proxy] Error:", err.message);
        res.writeHead(502);
        res.end("API server unavailable");
      });
      req.pipe(proxyReq, { end: true });
      return;
    }
    return middleware(req, res, next);
  };
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
