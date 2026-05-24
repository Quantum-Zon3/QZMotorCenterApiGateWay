import { createLogger, format, transports } from "winston";
import morgan from "morgan";
import { env } from "../config/env";
import fs from "fs";
import path from "path";

// ─── Directorio de logs ──────────────────────────────────────────────────────
const logsDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ─── Winston: logger estructurado interno ────────────────────────────────────
export const logger = createLogger({
  level: env.nodeEnv === "production" ? "warn" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: "qz-gateway" },
  transports: [
    // Archivo: solo errores
    new transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
    }),
    // Archivo: todos los niveles
    new transports.File({
      filename: path.join(logsDir, "combined.log"),
    }),
  ],
});

// En desarrollo, también imprime en consola con colores
if (env.nodeEnv !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    })
  );
}

// ─── Morgan: logger de peticiones HTTP ───────────────────────────────────────
// Formato personalizado: método, URL, status, tiempo, IP
const morganFormat = env.nodeEnv === "production" ? "combined" : "dev";

// Stream que redirige morgan → winston
const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export const httpLogger = morgan(morganFormat, { stream: morganStream });
