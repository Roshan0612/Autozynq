import { prisma } from "../lib/prisma";
import { runWorkflow } from "../lib/execution/engine";

async function main() {
  const workflowId = process.argv[2] || "cmpwyg0860007igxdhr1tfvh2";

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, name: true, status: true, userId: true, definition: true },
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  console.log("=== Google Workflow Chain Test ===");
  console.log("Workflow ID:", workflow.id);
  console.log("Workflow Name:", workflow.name);
  console.log("Status:", workflow.status);
  console.log("User ID:", workflow.userId);
  console.log("Definition:", JSON.stringify(workflow.definition, null, 2));

  const triggerInput = {
    eventId: `manual-google-form-${Date.now()}`,
    formId: "test-form-123",
    responseId: `resp-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    respondentEmail: "tester@example.com",
    answers: {
      name: "Roshan",
      email: "roshan@example.com",
      message: "Testing the Google Forms -> Sheets -> Drive chain.",
    },
  };

  console.log("\nTrigger input:", JSON.stringify(triggerInput, null, 2));
  console.log("\nStarting execution...\n");

  const executionId = await runWorkflow({
    workflowId: workflow.id,
    userId: workflow.userId,
    triggerInput,
    idempotencyKey: triggerInput.eventId,
  });

  console.log("Execution ID:", executionId);

  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  console.log("Execution status:", execution?.status);
  console.log("Result:", JSON.stringify(execution?.result, null, 2));
  console.log("Error:", JSON.stringify(execution?.error, null, 2));
  console.log("Steps:", JSON.stringify(execution?.steps, null, 2));
}

main()
  .catch((error) => {
    console.error("Google chain test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
