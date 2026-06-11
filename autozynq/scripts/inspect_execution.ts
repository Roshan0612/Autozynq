import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const executionId = process.argv[2];

if (!executionId) {
  console.error('Usage: npx tsx scripts/inspect_execution.ts <executionId>');
  process.exit(1);
}

async function main() {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  console.log(JSON.stringify(execution, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
