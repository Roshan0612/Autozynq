import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const workflowId = process.argv[2];

if (!workflowId) {
  console.error('Usage: npx tsx scripts/inspect_workflow_artifacts.ts <workflowId>');
  process.exit(1);
}

async function main() {
  const [workflowTriggers, subscriptions] = await Promise.all([
    prisma.workflowTrigger.findMany({ where: { workflowId } }),
    prisma.triggerSubscription.findMany({ where: { workflowId } }),
  ]);

  console.log(JSON.stringify({ workflowId, workflowTriggers, subscriptions }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
