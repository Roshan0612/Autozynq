import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workflows = await prisma.workflow.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      definition: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  for (const workflow of workflows) {
    const definition = workflow.definition as any;
    const nodeTypes = Array.isArray(definition?.nodes)
      ? definition.nodes.map((node: any) => node.type).join(', ')
      : 'n/a';
    console.log(`id=${workflow.id} status=${workflow.status} name=${workflow.name} nodes=${nodeTypes}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
