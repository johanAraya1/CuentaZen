import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaultKey = process.env.DEFAULT_GLOBAL_KEY ?? "1234";
  const defaultExchangeRate = Number(process.env.DEFAULT_EXCHANGE_RATE ?? "520");
  const hash = await bcrypt.hash(defaultKey, 10);

  await prisma.appSetting.upsert({
    where: { id: 1 },
    update: {
      exchangeRate: defaultExchangeRate,
      globalKeyHash: hash
    },
    create: {
      id: 1,
      exchangeRate: defaultExchangeRate,
      globalKeyHash: hash
    }
  });
}

main()
  .catch((error) => {
    console.error("Seed error", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
