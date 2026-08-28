import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";

export default function healthRoutes(prisma) {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

      res.status(dbOk ? 200 : 503).json({
        status: dbOk ? "ok" : "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        dependencies: { database: dbOk ? "up" : "down" },
      });
    }),
  );

  return router;
}
