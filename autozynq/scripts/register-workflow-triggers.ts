import { registerWorkflowTriggers } from "../lib/triggers/service";
import { prisma } from "../lib/prisma";

async function main() {
  // Find the workflow
  const workflow = await prisma.workflow.findFirst({
    where: {
      name: {
        contains: "google sheet",
        mode: "insensitive",
      },
    },
  });

  if (!workflow) {
    console.error("Workflow 'google sheet' not found");
    process.exit(1);
  }

  console.log("=== Registering Triggers for Workflow ===");
  console.log("Workflow ID:", workflow.id);
  console.log("Workflow Name:", workflow.name);
  console.log("Status:", workflow.status);

  try {
    const registrations = await registerWorkflowTriggers(workflow.id);
    
    console.log("\n✅ Triggers registered successfully!");
    console.log(`Registered ${registrations.length} trigger(s):\n`);
    
    registrations.forEach((reg, index) => {
      console.log(`Trigger ${index + 1}:`);
      console.log(`  Trigger ID: ${reg.triggerId}`);
      console.log(`  Status: ${reg.status}`);
      if (reg.webhookUrl) {
        console.log(`  Webhook URL: ${reg.webhookUrl}`);
      }
      console.log();
    });

    console.log("Now start the polling service:");
    console.log("  npx tsx scripts/start-polling.ts");
  } catch (error: any) {
    console.error("\n❌ Failed to register triggers:");
    console.error(error.message);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
