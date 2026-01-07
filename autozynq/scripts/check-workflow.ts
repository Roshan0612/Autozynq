import { prisma } from "@/lib/prisma";

async function checkWorkflow() {
  const workflow = await prisma.workflow.findUnique({
    where: { id: "cmk49soa00003lgth1hls37ic" },
  });

  if (!workflow) {
    console.log("Workflow not found");
    return;
  }

  console.log("Workflow:", workflow.name);
  console.log("Status:", workflow.status);
  console.log("\nDefinition:");
  console.log(JSON.stringify(workflow.definition, null, 2));
}

checkWorkflow()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
