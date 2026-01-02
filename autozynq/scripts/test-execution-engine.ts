import { prisma } from "../lib/prisma";
import { runWorkflow } from "../lib/execution/engine";

/**
 * Test script for Execution Engine v1
 * 
 * Creates a test workflow (Gmail trigger → Slack action) and executes it
 */

async function main() {
  console.log("🚀 Testing Execution Engine v1\n");

  // Clean up any existing test data
  await prisma.workflow.deleteMany({
    where: { name: { startsWith: "Test Workflow -" } },
  });

  // Create a test user (or use existing)
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
      },
    });
    console.log("✅ Created test user:", user.email);
  } else {
    console.log("✅ Using existing user:", user.email);
  }

  // Create a test workflow: Gmail trigger → Slack action
  const workflow = await prisma.workflow.create({
    data: {
      name: `Test Workflow - ${new Date().toISOString()}`,
      userId: user.id,
      status: "ACTIVE",
      definition: {
        nodes: [
          {
            id: "trigger_1",
            type: "gmail.trigger.newEmail",
            config: {
              label: "Test Trigger",
              from: "sender@example.com",
            },
          },
          {
            id: "action_1",
            type: "slack.action.sendMessage",
            config: {
              channel: "#general",
              message: "New email received!",
            },
          },
        ],
        edges: [
          {
            from: "trigger_1",
            to: "action_1",
          },
        ],
      },
    },
  });

  console.log("\n✅ Created test workflow:", workflow.name);
  console.log("   Workflow ID:", workflow.id);
  console.log("   Status:", workflow.status);

  // Execute the workflow
  console.log("\n🔥 Starting workflow execution...\n");

  try {
    const executionId = await runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: {
        // Optional: override trigger data
        subject: "Manually triggered test email",
      },
    });

    console.log("\n✅ Workflow execution completed successfully!");
    console.log("   Execution ID:", executionId);

    // Fetch and display execution details
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { workflow: true },
    });

    if (execution) {
      console.log("\n📊 Execution Details:");
      console.log("   Status:", execution.status);
      console.log("   Started:", execution.startedAt.toISOString());
      console.log("   Finished:", execution.finishedAt?.toISOString());
      console.log("   Duration:", 
        execution.finishedAt 
          ? `${execution.finishedAt.getTime() - execution.startedAt.getTime()}ms`
          : "N/A"
      );

      if (execution.steps) {
        console.log("\n📝 Execution Steps:");
        const steps = execution.steps as any[];
        steps.forEach((step, idx) => {
          console.log(`   ${idx + 1}. Node: ${step.nodeId}`);
          console.log(`      Status: ${step.status}`);
          console.log(`      Output:`, JSON.stringify(step.output, null, 2).split('\n').join('\n      '));
        });
      }

      if (execution.result) {
        console.log("\n🎯 Final Result:");
        console.log("  ", JSON.stringify(execution.result, null, 2));
      }
    }

    console.log("\n✅ All tests passed! Execution engine is working correctly.\n");
  } catch (error) {
    console.error("\n❌ Workflow execution failed:");
    console.error("  ", error instanceof Error ? error.message : String(error));

    // Fetch execution to see error details
    const executions = await prisma.execution.findMany({
      where: { workflowId: workflow.id },
      orderBy: { startedAt: "desc" },
      take: 1,
    });

    if (executions[0] && executions[0].error) {
      console.log("\n📊 Execution Error Details:");
      console.log("  ", JSON.stringify(executions[0].error, null, 2));
    }

    if (executions[0] && executions[0].steps) {
      console.log("\n📝 Execution Steps:");
      const steps = executions[0].steps as any[];
      steps.forEach((step, idx) => {
        console.log(`   ${idx + 1}. Node: ${step.nodeId}`);
        console.log(`      Status: ${step.status}`);
        if (step.error) {
          console.log(`      Error: ${step.error}`);
        }
      });
    }

    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
