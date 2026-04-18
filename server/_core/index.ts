import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import httpProxy from "http-proxy";
import http from "http";

const METRO_PORT = parseInt(process.env.METRO_PORT || "8081");
const STATIC_DOMAIN = "mosulride-jlhuqvse.manus.space";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Helper: proxy a request to Metro and pipe response back
function proxyToMetro(
  req: express.Request,
  res: express.Response,
  metroPath: string,
) {
  const options = {
    hostname: "127.0.0.1",
    port: METRO_PORT,
    path: metroPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${METRO_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("[Metro Proxy] Error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Metro bundler unavailable");
    }
  });

  req.pipe(proxyReq, { end: true });
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // WebSocket proxy for Metro (Expo Go hot reload)
  const metroWsProxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${METRO_PORT}`,
    ws: true,
  });

  metroWsProxy.on("error", () => {
    // Silently ignore - Metro may not be running
  });

  // Forward WebSocket upgrades to Metro
  server.on("upgrade", (req, socket, head) => {
    metroWsProxy.ws(req, socket, head);
  });

  // Enable CORS for all routes
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, expo-platform, expo-channel-name",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now(), version: "v2-metro-proxy", routes: ["/api/metro/manifest", "/api/metro/bundle", "/api/metro/asset"] });
  });

  // Admin panel
  app.get("/admin", (_req, res) => {
    res.sendFile(path.resolve(__dirname, "../../server/admin-panel.html"));
  });

  // ============================================================
  // EXPO GO FIX: Metro proxy endpoints under /api/metro/
  // Cloudflare only forwards /api/* to this server.
  // We expose Metro bundle, assets, and manifest under /api/metro/
  // so Expo Go can load the app via the static domain.
  // ============================================================

  // Expo manifest endpoint - intercept and rewrite URLs to use static domain
  app.get("/api/metro/manifest", (req, res) => {
    const platform = (req.query.platform as string) || req.headers["expo-platform"] as string || "ios";
    const options = {
      hostname: "127.0.0.1",
      port: METRO_PORT,
      path: "/",
      method: "GET",
      headers: {
        ...req.headers,
        host: `127.0.0.1:${METRO_PORT}`,
        "expo-platform": platform,
        "accept": "application/expo+json",
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let body = "";
      proxyRes.setEncoding("utf8");
      proxyRes.on("data", (chunk) => { body += chunk; });
      proxyRes.on("end", () => {
        try {
          const manifest = JSON.parse(body);

          // Rewrite debuggerHost to static domain
          if (manifest.extra?.expoGo?.debuggerHost) {
            manifest.extra.expoGo.debuggerHost = STATIC_DOMAIN;
          }

          // Rewrite launchAsset URL: /node_modules/... → /api/metro/bundle?p=...
          if (manifest.launchAsset?.url) {
            const originalUrl = manifest.launchAsset.url;
            // Extract path from URL
            const urlObj = new URL(originalUrl);
            const bundlePath = urlObj.pathname + urlObj.search;
            manifest.launchAsset.url = `https://${STATIC_DOMAIN}/api/metro/bundle?p=${encodeURIComponent(bundlePath)}`;
          }

          // Rewrite asset URLs
          if (manifest.assets) {
            manifest.assets = manifest.assets.map((asset: any) => {
              if (asset.url) {
                const urlObj = new URL(asset.url);
                const assetPath = urlObj.pathname + urlObj.search;
                asset.url = `https://${STATIC_DOMAIN}/api/metro/asset?p=${encodeURIComponent(assetPath)}`;
              }
              return asset;
            });
          }

          const rewritten = JSON.stringify(manifest);
          res.writeHead(proxyRes.statusCode || 200, {
            "content-type": "application/expo+json",
            "content-length": Buffer.byteLength(rewritten),
            "cache-control": "no-cache",
          });
          res.end(rewritten);
        } catch {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          res.end(body);
        }
      });
    });

    proxyReq.on("error", () => {
      res.status(502).json({ error: "Metro bundler unavailable" });
    });

    proxyReq.end();
  });

  // Bundle proxy: /api/metro/bundle?p=/node_modules/expo-router/entry.bundle?...
  app.get("/api/metro/bundle", (req, res) => {
    const encodedPath = req.query.p as string;
    if (!encodedPath) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }
    const metroPath = decodeURIComponent(encodedPath);
    proxyToMetro(req, res, metroPath);
  });

  // Asset proxy: /api/metro/asset?p=/assets/...
  app.get("/api/metro/asset", (req, res) => {
    const encodedPath = req.query.p as string;
    if (!encodedPath) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }
    const metroPath = decodeURIComponent(encodedPath);
    proxyToMetro(req, res, metroPath);
  });

  // Generic Metro proxy: /api/metro/proxy?p=/any/metro/path
  app.use("/api/metro/proxy", (req, res) => {
    const encodedPath = req.query.p as string;
    if (!encodedPath) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }
    const metroPath = decodeURIComponent(encodedPath);
    proxyToMetro(req, res, metroPath);
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    console.log(`[expo] Metro proxy: https://${STATIC_DOMAIN}/api/metro/manifest`);
  });
}

startServer().catch(console.error);
