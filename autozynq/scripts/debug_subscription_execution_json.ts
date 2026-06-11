import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
  const workflowId = 'cmpy02seo000teumj175esnfv';
  const executions = await prisma.execution.findMany({
    where: { workflowId },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });
  writeFileSync('scripts/debug_subscription_execution_json_output.json', JSON.stringify(executions, null, 2), 'utf8');
  console.log('wrote scripts/debug_subscription_execution_json_output.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});