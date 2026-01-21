import { prisma } from "@/lib/prisma";
import { runWorkflow } from "@/lib/execution/engine";

/**
 * Verification script for new nodes: Google Form → AI → Gmail
 * 
 * This script:
 * 1. Creates a workflow: Google Form Trigger → AI Generate Text → Gmail Send Email
 * 2. Activates the workflow
 * 3. Simulates a webhook POST with form response
 * 4. Verifies execution completes successfully with correct outputs
 */

async function main() {
  console.log("🧪 Verifying New Nodes: Google Form → AI → Gmail\n");

  // Clean up test data
  console.log("📋 Cleaning up previous test data...");
  await prisma.workflow.deleteMany({
    where: { name: { contains: "Node Verification" } },
  });

  // Get or create test user
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

  // Create workflow: Google Form → AI → Gmail
  console.log("\n📝 Creating workflow: Google Form → AI → Gmail");
  const workflow = await prisma.workflow.create({
    data: {
      name: "Node Verification - Google Form → AI → Gmail",
      userId: user.id,
      status: "DRAFT",
      definition: {
        nodes: [
          {
            id: "trigger_googleform",
            type: "google_forms.trigger.newResponse",
            config: {
              formId: "test-form-123",
              includeAttachments: false,
              conditions: [
                {
                  field: "email",
                  operator: "exists",
                },
              ],
            },
          },
          {
            id: "action_ai",
            type: "ai.action.generateText",
            category: "action",
            config: {
              provider: "groq",
              model: "llama-3.3-70b-versatile",
              userPrompt:
                "Generate a friendly confirmation email response to this form submission. Keep it concise (2-3 sentences).",
              temperature: 0.7,
              maxTokens: 200,
            },
          },
          {
            id: "action_gmail",
            type: "gmail.action.sendEmail",
            config: {
              to: "{{email}}",
              subject: "Form Submission Confirmation",
              bodyHtml: "{{text}}",
            },
          },
        ],
        edges: [
          { from: "trigger_googleform", to: "action_ai" },
          { from: "action_ai", to: "action_gmail" },
        ],
      },
    },
  });

  console.log("✅ Workflow created:", workflow.id);
  console.log("   Name:", workflow.name);
  console.log("   Nodes:", workflow.definition.nodes.length);
  console.log("   Edges:", workflow.definition.edges.length);

  // Activate workflow
  console.log("\n🔄 Activating workflow...");
  const updatedWorkflow = await prisma.workflow.update({
    where: { id: workflow.id },
    data: { status: "ACTIVE" },
  });
  console.log("✅ Workflow activated");

  // Simulate webhook trigger with form response
  console.log("\n🌐 Simulating Google Form webhook payload...");
  const formPayload = {
    responseId: "resp_test_001",
    timestamp: new Date().toISOString(),
    answers: {
      email: "user@example.com",
      name: "John Doe",
      message: "I would like to know more about your service.",
    },
  };

  console.log("   Payload:", JSON.stringify(formPayload, null, 2));

  // Execute workflow
  console.log("\n⚡ Executing workflow...");
  try {
    const executionId = await runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: formPayload,
    });

    console.log("✅ Execution started:", executionId);

    // Fetch execution details
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        workflow: true,
        steps: {
          orderBy: { index: "asc" },
        },
      },
    });

    if (!execution) {
      console.error("❌ Execution not found");
      return;
    }

    console.log("\n📊 Execution Results:");
    console.log("   ID:", execution.id);
    console.log("   Status:", execution.status);
    console.log("   Started:", execution.startedAt.toISOString());
    console.log("   Finished:", execution.finishedAt?.toISOString());
    console.log("   Duration:",
      execution.finishedAt
        ? `${execution.finishedAt.getTime() - execution.startedAt.getTime()}ms`
        : "Still running"
    );

    console.log("\n📈 Step Execution:");
    for (const step of execution.steps) {
      const statusIcon = step.status === "SUCCESS" ? "✅" : step.status === "FAILED" ? "❌" : "⏳";
      console.log(`   ${statusIcon} Step ${step.index} (${step.nodeId}): ${step.status}`);

      if (step.output) {
        console.log(`      Output:`, JSON.stringify(step.output, null, 6).substring(0, 200) + "...");
      }

      if (step.error) {
        console.log(`      Error:`, step.error);
      }
    }

    // Verify acceptance criteria
    console.log("\n✔️ Acceptance Criteria Verification:");

    const trigger = execution.steps[0];
    const aiStep = execution.steps[1];
    const gmailStep = execution.steps[2];

    const allPassed = [
      {
        label: "Trigger executed",
        passed: trigger?.status === "SUCCESS",
      },
      {
        label: "AI node generated text",
        passed: aiStep?.status === "SUCCESS" && aiStep?.output?.text,
      },
      {
        label: "Gmail node sent email",
        passed: gmailStep?.status === "SUCCESS" && gmailStep?.output?.messageId,
      },
      {
        label: "Execution completed successfully",
        passed: execution.status === "SUCCESS",
      },
      {
        label: "All steps executed in order",
        passed: execution.steps.length === 3 && execution.steps.every((s) => s.status === "SUCCESS"),
      },
    ];

    allPassed.forEach(({ label, passed }) => {
      console.log(`   ${passed ? "✅" : "❌"} ${label}`);
    });

    if (allPassed.every(({ passed }) => passed)) {
      console.log("\n🎉 All verification tests passed!");
      console.log("\n📋 Summary:");
      console.log("   - Google Form Trigger: Successfully received and processed webhook");
      console.log("   - AI Action Node: Generated confirmation text");
      console.log("   - Gmail Action Node: Sent email to recipient");
      console.log("   - Execution Engine: Ran all nodes end-to-end with correct output chaining");
    } else {
      console.log("\n⚠️ Some verification tests failed");
    }
  } catch (error) {
    console.error("❌ Execution failed:", error);
    process.exit(1);
  }

  console.log("\n✅ Verification complete");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
