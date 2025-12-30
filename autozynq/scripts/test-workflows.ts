import { prisma } from "@/lib/prisma";
import { WorkflowDefinition } from "@/lib/workflow/schema";

/**
 * Test script to verify workflow API and validation logic.
 * 
 * Usage:
 *   1. Ensure DATABASE_URL is set in .env
 *   2. Ensure you have at least one user in the database
 *   3. Update USER_ID below with a real user ID
 *   4. Run: npx ts-node --project tsconfig.json scripts/test-workflows.ts
 * 
 * Or use Prisma's standalone script runner:
 *   npx tsx scripts/test-workflows.ts
 */

// ⚠️ CHANGE THIS TO A REAL USER ID FROM YOUR DATABASE
const USER_ID = "YOUR_USER_ID_HERE";

async function main() {
  console.log("🧪 Testing Workflow Core Domain\n");

  // Test 1: Valid workflow with trigger + action
  console.log("✅ Test 1: Create valid workflow");
  const validDefinition: WorkflowDefinition = {
    nodes: [
      { id: "trigger1", type: "webhook.trigger", config: { path: "/hook" } },
      { id: "action1", type: "slack.action.send", config: { channel: "#alerts", message: "Hello!" } },
    ],
    edges: [{ from: "trigger1", to: "action1" }],
  };

  try {
    const workflow1 = await prisma.workflow.create({
      data: {
        name: "Test Workflow - Valid",
        userId: USER_ID,
        status: "DRAFT",
        definition: validDefinition,
      },
    });
    console.log(`   Created workflow: ${workflow1.id}`);
    console.log(`   Status: ${workflow1.status}\n`);
  } catch (error) {
    console.error("   ❌ Failed:", error);
  }

  // Test 2: Workflow with multiple actions (linear chain)
  console.log("✅ Test 2: Create workflow with multiple actions");
  const chainDefinition: WorkflowDefinition = {
    nodes: [
      { id: "trigger1", type: "gmail.trigger.newEmail", config: {} },
      { id: "action1", type: "slack.action.send", config: { channel: "#inbox" } },
      { id: "action2", type: "notion.action.createPage", config: { database: "Tasks" } },
    ],
    edges: [
      { from: "trigger1", to: "action1" },
      { from: "action1", to: "action2" },
    ],
  };

  try {
    const workflow2 = await prisma.workflow.create({
      data: {
        name: "Test Workflow - Chain",
        userId: USER_ID,
        status: "DRAFT",
        definition: chainDefinition,
      },
    });
    console.log(`   Created workflow: ${workflow2.id}\n`);
  } catch (error) {
    console.error("   ❌ Failed:", error);
  }

  // Test 3: Workflow with branching (one trigger, two parallel actions)
  console.log("✅ Test 3: Create workflow with branching");
  const branchDefinition: WorkflowDefinition = {
    nodes: [
      { id: "trigger1", type: "stripe.trigger.payment", config: {} },
      { id: "action1", type: "email.action.send", config: { to: "admin@example.com" } },
      { id: "action2", type: "analytics.action.track", config: { event: "payment_received" } },
    ],
    edges: [
      { from: "trigger1", to: "action1" },
      { from: "trigger1", to: "action2" },
    ],
  };

  try {
    const workflow3 = await prisma.workflow.create({
      data: {
        name: "Test Workflow - Branch",
        userId: USER_ID,
        status: "DRAFT",
        definition: branchDefinition,
      },
    });
    console.log(`   Created workflow: ${workflow3.id}\n`);
  } catch (error) {
    console.error("   ❌ Failed:", error);
  }

  // Test 4: List all workflows
  console.log("📋 Test 4: List all workflows for user");
  const workflows = await prisma.workflow.findMany({
    where: { userId: USER_ID },
    orderBy: { createdAt: "desc" },
  });
  console.log(`   Found ${workflows.length} workflows:`);
  workflows.forEach((w) => {
    console.log(`   - ${w.name} (${w.status})`);
  });
  console.log();

  // Test 5: Simulate activation (would normally go through API)
  if (workflows.length > 0) {
    console.log("🚀 Test 5: Activate first workflow");
    const firstWorkflow = workflows[0];
    try {
      const activated = await prisma.workflow.update({
        where: { id: firstWorkflow.id },
        data: { status: "ACTIVE" },
      });
      console.log(`   Activated: ${activated.name} → ${activated.status}\n`);
    } catch (error) {
      console.error("   ❌ Failed:", error);
    }
  }

  // Test 6: Create execution for activated workflow
  const activeWorkflows = await prisma.workflow.findMany({
    where: { userId: USER_ID, status: "ACTIVE" },
  });

  if (activeWorkflows.length > 0) {
    console.log("⚡ Test 6: Create execution for active workflow");
    const workflow = activeWorkflows[0];
    const execution = await prisma.execution.create({
      data: {
        workflowId: workflow.id,
        status: "PENDING",
      },
    });
    console.log(`   Created execution: ${execution.id}`);
    console.log(`   Status: ${execution.status}`);
    console.log(`   Started at: ${execution.startedAt}\n`);
  }

  // Test 7: Simulate execution completion
  const pendingExecution = await prisma.execution.findFirst({
    where: { status: "PENDING" },
  });

  if (pendingExecution) {
    console.log("✨ Test 7: Complete execution");
    const completed = await prisma.execution.update({
      where: { id: pendingExecution.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
      },
    });
    console.log(`   Execution ${completed.id} → ${completed.status}`);
    console.log(`   Duration: ${completed.finishedAt!.getTime() - completed.startedAt.getTime()}ms\n`);
  }

  // Test 8: Query executions for a workflow
  if (activeWorkflows.length > 0) {
    console.log("📊 Test 8: List executions for workflow");
    const executions = await prisma.execution.findMany({
      where: { workflowId: activeWorkflows[0].id },
      orderBy: { startedAt: "desc" },
    });
    console.log(`   Found ${executions.length} executions:`);
    executions.forEach((e) => {
      const duration = e.finishedAt ? `${e.finishedAt.getTime() - e.startedAt.getTime()}ms` : "running";
      console.log(`   - ${e.id} → ${e.status} (${duration})`);
    });
    console.log();
  }

  console.log("✅ All tests completed!\n");
}

main()
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
