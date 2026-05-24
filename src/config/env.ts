import "dotenv/config";

// ─── Helper: lee variable de entorno o lanza error en producción ─────────────
const readEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value && value.trim().length > 0) return value.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`[env] Variable de entorno requerida no encontrada: ${key}`);
};

export const env = {
  port: parseInt(readEnv("PORT", "4000"), 10),
  nodeEnv: readEnv("NODE_ENV", "development"),

  // CORS
  corsOrigin: readEnv("CORS_ORIGIN", "http://localhost:5173"),

  // Rate Limiting — Global
  rateLimitWindowMs: parseInt(readEnv("RATE_LIMIT_WINDOW_MS", "900000"), 10),
  rateLimitMax: parseInt(readEnv("RATE_LIMIT_MAX", "100"), 10),

  // Rate Limiting — Auth
  authRateLimitWindowMs: parseInt(readEnv("AUTH_RATE_LIMIT_WINDOW_MS", "60000"), 10),
  authRateLimitMax: parseInt(readEnv("AUTH_RATE_LIMIT_MAX", "10"), 10),

  // Microservices base URLs
  authApiUrl: readEnv("AUTH_API_URL", "http://localhost:8081"),
  carsApiUrl: readEnv("CARS_API_URL", "http://localhost:3001"),
  motorcyclesApiUrl: readEnv("MOTORCYCLES_API_URL", "http://localhost:5000"),
  electrobikesApiUrl: readEnv("ELECTROBIKES_API_URL", "https://qzmotorcenter-electrobike-api.onrender.com"),
  scootersApiUrl: readEnv("SCOOTERS_API_URL", "http://localhost:3003"),
  reportsApiUrl: readEnv("REPORTS_API_URL", "http://localhost:8080"),
  aiApiUrl: readEnv("AI_API_URL", "http://localhost:8000"),
  serverlessApiUrl: readEnv("SERVERLESS_API_URL", "http://localhost:3004"),
} as const;
