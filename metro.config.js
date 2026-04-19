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
    // Proxy /api requests to the API server
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

    // Intercept Expo manifest requests and strip debuggerHost
    // This prevents Expo Go from attempting WebSocket connections
    // which fail in sandbox environments (proxy returns HTML instead of 101)
    const isManifestRequest =
      req.headers["expo-platform"] ||
      (req.headers["accept"] && req.headers["accept"].includes("application/expo+json"));

    if (isManifestRequest && (req.url === "/" || req.url === "")) {
      // Let Metro handle the request first, then intercept the response
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);
      const originalWriteHead = res.writeHead.bind(res);

      let responseBody = "";
      let statusCode = 200;
      let responseHeaders = {};

      res.writeHead = (code, headers) => {
        statusCode = code;
        responseHeaders = headers || {};
      };

      res.write = (chunk) => {
        responseBody += chunk.toString();
      };

      res.end = (chunk) => {
        if (chunk) responseBody += chunk.toString();

        try {
          const manifest = JSON.parse(responseBody);

          // Remove debuggerHost to prevent WebSocket connection attempts
          if (manifest.extra && manifest.extra.expoGo) {
            delete manifest.extra.expoGo.debuggerHost;
            console.log("[Metro] Stripped debuggerHost from manifest for Expo Go compatibility");
          }

          const newBody = JSON.stringify(manifest);
          responseHeaders["content-length"] = Buffer.byteLength(newBody).toString();
          responseHeaders["content-type"] = "application/expo+json";

          originalWriteHead(statusCode, responseHeaders);
          originalEnd(newBody);
        } catch (e) {
          // Not JSON or parse error, pass through as-is
          originalWriteHead(statusCode, responseHeaders);
          originalEnd(responseBody);
        }
      };

      return middleware(req, res, next);
    }

    return middleware(req, res, next);
  };
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
