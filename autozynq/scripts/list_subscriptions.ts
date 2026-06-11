import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.triggerSubscription.findMany({
    take: 200,
    select: {
      id: true,
      webhookPath: true,
      workflowId: true,
      nodeId: true,
      executionCount: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (subs.length === 0) {
    console.log('No trigger subscriptions found. Activate a workflow to create one.');
    return;
  }

  for (const s of subs) {
    console.log(`id=${s.id} path=${s.webhookPath} workflow=${s.workflowId} node=${s.nodeId} executions=${s.executionCount} created=${s.createdAt}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
