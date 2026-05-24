import express, { Request, Response, NextFunction } from "express";
import { env } from "./config/env";
import { corsMiddleware } from "./middleware/cors.middleware";
import { httpLogger, logger } from "./middleware/logger.middleware";
import { globalRateLimiter } from "./middleware/rateLimiter.middleware";
import proxyRouter from "./proxy/proxy.routes";

const app = express();

// ═══════════════════════════════════════════════════════════════════════════════
//  MIDDLEWARES GLOBALES
//  Orden importante: CORS → Logger → Rate Limiter → Body Parser → Rutas
// ═══════════════════════════════════════════════════════════════════════════════

// 1. CORS — debe ser el primero para manejar pre-flight OPTIONS correctamente
app.use(corsMiddleware);

// 2. HTTP Logger (Morgan → Winston)
app.use(httpLogger);

// 3. Rate Limiter Global (100 req / 15 min por IP)
app.use(globalRateLimiter);

// 4. Parse JSON y form-urlencoded en el Gateway (para rutas propias, no proxy)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTA DE SALUD PROPIA DEL GATEWAY
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "qz-gateway",
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    uptime: `${Math.floor(process.uptime())}s`,
    microservices: {
      auth: env.authApiUrl,
      cars: env.carsApiUrl,
      motorcycles: env.motorcyclesApiUrl,
      electrobikes: env.electrobikesApiUrl,
      scooters: env.scootersApiUrl,
      reports: env.reportsApiUrl,
      ai: env.aiApiUrl,
      serverless: env.serverlessApiUrl,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTAS DE PROXY — Auth, Inventario, Reportes, IA, Serverless
// ═══════════════════════════════════════════════════════════════════════════════
app.use("/", proxyRouter);

// ═══════════════════════════════════════════════════════════════════════════════
//  MANEJADORES DE ERROR GLOBALES
// ═══════════════════════════════════════════════════════════════════════════════

// 404 — Ruta no encontrada en el Gateway
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 404,
    error: "Ruta no encontrada en el Gateway.",
  });
});

// 500 — Error no controlado (último recurso)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error("Error no controlado en el Gateway", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // CORS error originado desde el middleware de cors
  if (err.message.startsWith("CORS:")) {
    res.status(403).json({ status: 403, error: err.message });
    return;
  }

  res.status(500).json({
    status: 500,
    error: "Error interno del API Gateway.",
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INICIO DEL SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════════
if (process.env.NODE_ENV !== "test") {
  app.listen(env.port, () => {
    logger.info(`🚀 QZ Motor Center API Gateway corriendo`, {
      port: env.port,
      env: env.nodeEnv,
      cors: env.corsOrigin,
      rateLimit: `${env.rateLimitMax} req / ${env.rateLimitWindowMs / 1000 / 60} min`,
    });

    if (env.nodeEnv === "development") {
      console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║         QZ Motor Center  —  API Gateway              ║
  ║──────────────────────────────────────────────────────║
  ║  ✅ Escuchando en  http://localhost:${env.port}           ║
  ║  🔒 JWT            Validación remota → Auth service  ║
  ║  🚦 Rate Limit     ${env.rateLimitMax} req / ${env.rateLimitWindowMs / 60000} min (global)         ║
  ║  🌐 CORS           ${env.corsOrigin.slice(0, 35).padEnd(35)}  ║
  ║  📋 Logs           ./logs/combined.log               ║
  ╚══════════════════════════════════════════════════════╝
      `);
    }
  });
}

export default app;
