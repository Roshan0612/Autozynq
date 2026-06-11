import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const connectionId = process.argv[2];

if (!connectionId) {
  console.error('Usage: npx tsx scripts/inspect_connection.ts <connectionId>');
  process.exit(1);
}

async function main() {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  console.log(JSON.stringify(connection, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
