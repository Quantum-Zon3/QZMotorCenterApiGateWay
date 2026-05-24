import rateLimit from "express-rate-limit";
import { env } from "../config/env";

// ─── Rate Limiter Global ──────────────────────────────────────────────────────
// Aplica a todas las rutas: 100 req / 15 min por IP
export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,  // Incluye cabeceras RateLimit-* (RFC 6585)
  legacyHeaders: false,   // Deshabilita cabeceras X-RateLimit-* legacy
  message: {
    status: 429,
    error: "Demasiadas peticiones. Por favor espera un momento antes de reintentar.",
  },
  skip: (req) => req.path === "/health", // El health-check nunca es limitado
});

// ─── Rate Limiter de Autenticación ───────────────────────────────────────────
// Más estricto: 10 req / 1 min por IP — Protege contra brute-force en login
export const authRateLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: "Demasiados intentos de autenticación. Espera 1 minuto antes de volver a intentarlo.",
  },
});
