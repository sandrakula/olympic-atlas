import "dotenv/config";
import { applyReleaseAudit } from "../prisma/data/release-audit";
import { prisma } from "../src/lib/prisma";

applyReleaseAudit(prisma).then(console.log).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
