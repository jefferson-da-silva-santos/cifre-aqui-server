import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

export function createPrismaClient() {
  return new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
