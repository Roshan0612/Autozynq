import { runWorkflow } from "../lib/execution/engine";
import { prisma } from "../lib/prisma";

/**
 * Manually trigger the Google Sheets workflow with test form data.
 * This simulates a Google Forms submission for testing.
 */
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

  console.log("=== Testing Google Sheets Workflow ===");
  console.log("Workflow ID:", workflow.id);
  console.log("Workflow Name:", workflow.name);
  console.log("Status:", workflow.status);

  // Simulate Google Forms trigger data
  const triggerInput = {
    eventId: `manual-test-${Date.now()}`,
    formId: "19g8-0Ll4TNlEtkMi4mbtd1q7Qo2JgIA2H8r4SBlSqxE",
    responseId: `test-response-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    respondentEmail: "test@example.com",
    answers: {
      name: "Test User",
      email: "test@example.com",
      message: "This is a test message from the manual trigger script.",
    },
  };

  console.log("\n=== Trigger Input ===");
  console.log(JSON.stringify(triggerInput, null, 2));

  console.log("\n=== Starting Execution ===");
  
  try {
    const executionId = await runWorkflow({
      workflowId: workflow.id,
      triggerInput,
      userId: workflow.userId,
      idempotencyKey: triggerInput.eventId,
    });

    console.log("\n✅ Execution completed successfully!");
    console.log("Execution ID:", executionId);

    // Fetch execution details
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
    });

    console.log("\n=== Execution Result ===");
    console.log("Status:", execution?.status);
    console.log("Steps:", execution?.steps?.length || 0);
    
    if (execution?.error) {
      console.error("Error:", JSON.stringify(execution.error, null, 2));
    }
    
    if (execution?.result) {
      console.log("Result:", JSON.stringify(execution.result, null, 2));
    }

    if (execution?.steps && Array.isArray(execution.steps)) {
      console.log("\n=== Step Details ===");
      execution.steps.forEach((step: any, index: number) => {
        console.log(`\nStep ${index + 1}: ${step.nodeId} (${step.nodeType})`);
        console.log("  Status:", step.status);
        if (step.output) {
          console.log("  Output:", JSON.stringify(step.output, null, 2));
        }
        if (step.error) {
          console.error("  Error:", step.error);
        }
      });
    }
  } catch (error: any) {
    console.error("\n❌ Execution failed:");
    console.error(error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
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
