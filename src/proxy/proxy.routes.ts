import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { env } from "../config/env";
import { verifyJwt } from "../middleware/auth.middleware";
import { authRateLimiter } from "../middleware/rateLimiter.middleware";
import { logger } from "../middleware/logger.middleware";

const router = Router();

// ─── Helper: crea un proxy apuntando a un microservicio ──────────────────────
const makeProxy = (target: string, pathRewrite?: Record<string, string>) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      error: (err, req, res) => {
        logger.error("Error de proxy hacia microservicio", {
          target,
          path: (req as import("express").Request).path,
          error: err.message,
        });
        // http-proxy-middleware tipea res como ServerResponse | Socket;
        // sólo actuamos si es una ServerResponse HTTP real
        const httpRes = res as import("http").ServerResponse;
        if (!httpRes.headersSent) {
          (res as import("express").Response).status(502).json({
            status: 502,
            error: `El microservicio no está disponible (${target}). Intenta más tarde.`,
          });
        }
      },
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        proxyReq.removeHeader("origin");

        // Reenvía el user payload al microservicio como cabecera (opcional)
        const typedReq = req as import("express").Request;
        if (typedReq.user) {
          proxyReq.setHeader("X-Gateway-User", JSON.stringify(typedReq.user));
        }
        logger.debug("Proxy request", {
          method: typedReq.method,
          originalUrl: typedReq.originalUrl,
          target,
        });
      },
    },
  });

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTAS PÚBLICAS — No requieren JWT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /auth/login
 * Reenvía al microservicio Auth. Limitado con authRateLimiter (anti brute-force).
 */
router.post(
  "/auth/register",
  authRateLimiter,
  makeProxy(env.authApiUrl, { "^/auth/register": "/qzwork_hub/auth" })
);

router.post(
  "/auth/login",
  authRateLimiter,
  makeProxy(env.authApiUrl, { "^/auth/login": "/qzwork_hub/auth/login" })
);

/**
 * POST /auth/refresh-token
 * Renueva el accessToken usando el refreshToken. Sin JWT, con rate limit de auth.
 */
router.post(
  "/auth/refresh-token",
  authRateLimiter,
  makeProxy(env.authApiUrl, {
    "^/auth/refresh-token": "/qzwork_hub/auth/refresh-token",
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTAS PROTEGIDAS — Requieren JWT válido
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /auth/logout
 * Revoca la sesión. Requiere JWT.
 */
router.post(
  "/auth/logout",
  verifyJwt,
  makeProxy(env.authApiUrl, { "^/auth/logout": "/qzwork_hub/auth/logout" })
);

/**
 * /api/cars/**
 * CRUD de automóviles — Node + Express + PostgreSQL
 */
router.use("/api/cars", verifyJwt, makeProxy(env.carsApiUrl));

/**
 * /api/motorcycles/**
 * CRUD de motocicletas — Flask + SQLAlchemy + MySQL
 */
router.use("/api/motorcycles", verifyJwt, makeProxy(env.motorcyclesApiUrl));

/**
 * /api/electrobikes/**
 * Catálogo de bicicletas eléctricas — Node + Sequelize
 * También expone /api/health en este microservicio
 */
router.use("/api/electrobikes", verifyJwt, makeProxy(env.electrobikesApiUrl));

/**
 * /api/marcas/**
 * Marcas del catálogo ElectroBike. Se conserva este path porque el
 * microservicio lo expone bajo /api/marcas.
 */
router.use("/api/marcas", verifyJwt, makeProxy(env.electrobikesApiUrl));

/**
 * /api/health (electrobikes health-check)
 * Redirige al health-check propio del servicio de electrobikes
 */
router.get(
  "/health/electrobikes",
  verifyJwt,
  makeProxy(env.electrobikesApiUrl, {
    "^/health/electrobikes": "/api/health",
  })
);

/**
 * /api/scooters/**
 * Microservicio de scooters — Node + Express + MySQL
 */
router.use("/api/scooters", verifyJwt, makeProxy(env.scootersApiUrl));

/**
 * /api/reports/**
 * Reportes de ventas — Node + Express + MongoDB
 * Health-check en /health del microservicio
 */
router.use("/api/reports", verifyJwt, makeProxy(env.reportsApiUrl));

router.get(
  "/health/reports",
  verifyJwt,
  makeProxy(env.reportsApiUrl, { "^/health/reports": "/health" })
);

/**
 * /api/v1/**
 * Asistente de IA — FastAPI + PostgreSQL
 * Health-check en /health del microservicio
 */
router.use("/api/v1", verifyJwt, makeProxy(env.aiApiUrl));

router.get(
  "/health/ai",
  verifyJwt,
  makeProxy(env.aiApiUrl, { "^/health/ai": "/health" })
);

/**
 * /api/enviarCorreo/**
 * Automatizaciones de correo serverless — Node + SendGrid
 */
router.use("/api/enviarCorreo", verifyJwt, makeProxy(env.serverlessApiUrl));

export default router;
