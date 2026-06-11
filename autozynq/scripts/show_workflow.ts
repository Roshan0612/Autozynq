import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const workflowId = process.argv[2];

if (!workflowId) {
  console.error('Usage: npx tsx scripts/show_workflow.ts <workflowId>');
  process.exit(1);
}

async function main() {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      triggers: true,
      triggerSubscriptions: true,
    },
  });

  if (!workflow) {
    console.log('Workflow not found');
    return;
  }

  console.log(JSON.stringify(workflow, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
