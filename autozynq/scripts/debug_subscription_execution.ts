import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workflowId = 'cmpy02seo000teumj175esnfv';
  const executions = await prisma.execution.findMany({
    where: { workflowId },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(executions, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});