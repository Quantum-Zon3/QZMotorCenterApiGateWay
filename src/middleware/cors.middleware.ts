import cors, { CorsOptions } from "cors";
import { env } from "../config/env";

// Parsea los orígenes separados por coma para soportar múltiples dominios
const allowedOrigins: string[] = env.corsOrigin
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Permite peticiones sin origin (Postman, curl, servidor a servidor)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origen no permitido → ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
  credentials: true,
  maxAge: 86400, // Pre-flight cache: 24 horas
};

export const corsMiddleware = cors(corsOptions);
