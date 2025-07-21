// C:\Users\sayu0\OptiOil-API\lib\prisma.ts

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"], // 本番では外してもOK
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
