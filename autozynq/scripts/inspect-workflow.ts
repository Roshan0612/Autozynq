import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const id = "cmk41qnlj0001185k27xtzuob";
  const wf = await prisma.workflow.findUnique({ where: { id } });
  console.log(JSON.stringify(wf?.definition, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
