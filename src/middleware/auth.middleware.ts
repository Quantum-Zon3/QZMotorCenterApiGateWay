import { Request, Response, NextFunction } from "express";
import axios from "axios";
import { env } from "../config/env";
import { logger } from "./logger.middleware";

// ─── Tipos extendidos ─────────────────────────────────────────────────────────
// Agrega el payload del usuario decodificado al objeto Request de Express
declare global {
  namespace Express {
    interface Request {
      user?: Record<string, unknown>;
    }
  }
}

// ─── Middleware de validación JWT (remota) ────────────────────────────────────
// Envía el token Bearer al microservicio Auth para validarlo.
// Si Auth responde 200 → el request avanza hacia el proxy.
// Si Auth responde 401/403 u otro error → el gateway devuelve 401.
export const verifyJwt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      status: 401,
      error: "No autorizado. Se requiere el header Authorization: Bearer <token>.",
    });
    return;
  }

  const token = authHeader.slice(7); // Remueve "Bearer "

  try {
    // Llama al endpoint de validación del microservicio Auth
    const { data } = await axios.get(
      `${env.authApiUrl}/qzwork_hub/auth/validate`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      }
    );

    // Adjunta el payload del usuario al request para uso posterior en logs
    req.user = data as Record<string, unknown>;

    logger.debug("JWT validado correctamente", {
      path: req.path,
      method: req.method,
      user: typeof data === "object" && data !== null && "email" in data
        ? (data as { email?: string }).email
        : "unknown",
    });

    next();
  } catch (error: unknown) {
    // Captura errores de Axios (respuesta del Auth service)
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 401 || status === 403) {
        logger.warn("JWT rechazado por el microservicio Auth", {
          path: req.path,
          method: req.method,
          status,
        });
        res.status(401).json({
          status: 401,
          error: "Token inválido o expirado. Por favor inicia sesión nuevamente.",
        });
        return;
      }

      // El microservicio Auth no respondió (caído / timeout)
      logger.error("Microservicio Auth no disponible durante validación JWT", {
        path: req.path,
        axiosMessage: error.message,
      });
      res.status(503).json({
        status: 503,
        error: "Servicio de autenticación no disponible. Intenta más tarde.",
      });
      return;
    }

    // Error inesperado en el Gateway mismo
    logger.error("Error inesperado en middleware de autenticación", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      status: 500,
      error: "Error interno del Gateway.",
    });
  }
};
