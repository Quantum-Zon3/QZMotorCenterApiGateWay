// ─── Mock http-proxy-middleware BEFORE importing app ─────────────────────────
// This prevents real network calls during tests: the proxy immediately
// calls our error handler instead of connecting to real microservices.
jest.mock("http-proxy-middleware", () => ({
  fixRequestBody: jest.fn(),
  createProxyMiddleware: (opts: any) => {
    return (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction
    ) => {
      // Simulate a proxy error so our error handler returns 502
      const err = new Error("ECONNREFUSED: mock proxy — no real network calls in tests");
      if (opts?.on?.error) {
        opts.on.error(err, req, res);
      } else {
        res.status(502).json({
          status: 502,
          error: `El microservicio no está disponible (${opts?.target}). Intenta más tarde.`,
        });
      }
    };
  },
}));

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
      message: "mock invalid token",
    }),
    isAxiosError: jest.fn((error) => Boolean(error?.isAxiosError)),
  },
}));

import request from "supertest";
import app from "../index";

describe("API Gateway Endpoints", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ─── Public Routes ─────────────────────────────────────────────────────────

  describe("GET /health — Gateway health check", () => {
    it("returns 200 with status ok and service name", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "ok",
        service: "qz-gateway",
      });
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("microservices");
    });

    it("exposes all microservice URLs in the response", async () => {
      const res = await request(app).get("/health");
      const { microservices } = res.body;
      const expected = ["auth", "cars", "motorcycles", "electrobikes", "scooters", "reports", "ai", "serverless"];
      expected.forEach((key) => {
        expect(microservices).toHaveProperty(key);
      });
    });
  });

  describe("POST /auth/login — Public proxy (no JWT required)", () => {
    it("returns 502 when auth microservice is unreachable", async () => {
      const res = await request(app).post("/auth/login").send({ email: "test@example.com", password: "pass" });
      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toContain("El microservicio no está disponible");
    });
  });

  describe("POST /auth/register — Public proxy (no JWT required)", () => {
    it("returns 502 when auth microservice is unreachable", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "test@example.com", password: "pass" });
      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toContain("El microservicio no está disponible");
    });
  });

  describe("POST /auth/refresh-token — Public proxy (no JWT required)", () => {
    it("returns 502 when auth microservice is unreachable", async () => {
      const res = await request(app)
        .post("/auth/refresh-token")
        .send({ refreshToken: "some-token" });
      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("Unknown routes", () => {
    it("returns 404 for routes not registered in the Gateway", async () => {
      const res = await request(app).get("/ruta-que-no-existe");
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ status: 404, error: "Ruta no encontrada en el Gateway." });
    });

    it("returns 404 for a random unknown path", async () => {
      const res = await request(app).get("/api/unknown-service/test");
      expect(res.status).toBe(404);
    });
  });

  // ─── Protected Routes (JWT required) ───────────────────────────────────────

  describe("Protected Routes — require valid JWT", () => {
    const protectedRoutes = [
      { method: "post",   url: "/auth/logout",                   label: "POST /auth/logout" },
      { method: "get",    url: "/api/cars/some-endpoint",         label: "GET  /api/cars/**" },
      { method: "post",   url: "/api/motorcycles/some-endpoint",  label: "POST /api/motorcycles/**" },
      { method: "put",    url: "/api/electrobikes/some-endpoint", label: "PUT  /api/electrobikes/**" },
      { method: "get",    url: "/health/electrobikes",            label: "GET  /health/electrobikes" },
      { method: "delete", url: "/api/scooters/some-endpoint",     label: "DELETE /api/scooters/**" },
      { method: "get",    url: "/api/reports/sales",              label: "GET  /api/reports/**" },
      { method: "get",    url: "/health/reports",                 label: "GET  /health/reports" },
      { method: "post",   url: "/api/v1/chat",                    label: "POST /api/v1/** (AI)" },
      { method: "get",    url: "/health/ai",                      label: "GET  /health/ai" },
      { method: "post",   url: "/api/enviarCorreo",               label: "POST /api/enviarCorreo" },
    ];

    protectedRoutes.forEach(({ method, url, label }) => {
      it(`${label} — returns 401 when Authorization header is missing`, async () => {
        const res = await (request(app) as any)[method](url);
        expect([401, 403]).toContain(res.status);
      });

      it(`${label} — returns 401 when token is malformed`, async () => {
        const res = await (request(app) as any)
          [method](url)
          .set("Authorization", "Bearer invalid.token.here");
        expect([401, 403]).toContain(res.status);
      });
    });
  });
});
