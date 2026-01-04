import { prisma } from "@/lib/prisma";
import { runWorkflow } from "@/lib/execution/engine";
import { WorkflowDefinition } from "@/lib/workflow/schema";

/**
 * Test: Execution Engine v2 with Branching
 * 
 * Workflow:
 * Trigger (numberInput)
 *   ↓
 * If Condition (value > 50?)
 *   ├─ true → Slack Action
 *   └─ false → (end)
 */

async function testBranchingWorkflow() {
  console.log("\n=== Test: Execution Engine v2 - Branching ===\n");

  try {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `test-branching-${Date.now()}@example.com`,
        name: "Test User",
      },
    });

    console.log(`✓ Created test user: ${user.id}`);

    // Create branching workflow
    const definition: WorkflowDefinition = {
      nodes: [
        {
          id: "trigger_1",
          type: "test.trigger.passthrough",
          config: {},
        },
        {
          id: "if_1",
          type: "logic.condition",
          config: {
            operator: "greaterThan",
            value: 50,
          },
        },
        {
          id: "slack_1",
          type: "slack.action.sendMessage",
          config: {
            channel: "#notifications",
            message: "Value is greater than 50!",
          },
        },
      ],
      edges: [
        {
          from: "trigger_1",
          to: "if_1",
        },
        {
          from: "if_1",
          to: "slack_1",
          condition: "true",
        },
      ],
    };

    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: "Test Branching Workflow",
        status: "ACTIVE",
        definition: definition as any,
      },
    });

    console.log(`✓ Created workflow: ${workflow.id}`);
    console.log(`  - Nodes: trigger → if condition → slack (conditional)`);
    console.log(`  - Edges: 2 (one conditional)`);

    // Test case 1: Input > 50 (should execute slack)
    console.log("\n📌 Test Case 1: Input = 75 (should follow true branch)");
    const exec1 = await runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: 75,
    });

    const execution1 = await prisma.execution.findUnique({
      where: { id: exec1 },
    });

    console.log(`✓ Execution created: ${exec1}`);
    console.log(`  Status: ${execution1?.status}`);
    console.log(`  Steps executed: ${(execution1?.steps as any[])?.length || 0}`);

    const steps1 = (execution1?.steps as any[]) || [];
    for (const step of steps1) {
      console.log(
        `    - ${step.nodeId} (${step.nodeType}): ${step.status}${
          step.status === "success" && step.output
            ? ` → ${JSON.stringify(step.output)}`
            : ""
        }`
      );
    }

    // Verify: should have 3 steps (trigger, if, slack)
    if (steps1.length === 3 && steps1.every((s) => s.status === "success")) {
      console.log("✅ PASS: All 3 steps executed successfully");
    } else {
      console.log("❌ FAIL: Expected 3 successful steps");
    }

    // Test case 2: Input < 50 (should NOT execute slack)
    console.log("\n📌 Test Case 2: Input = 30 (should not follow true branch)");
    const exec2 = await runWorkflow({
      workflowId: workflow.id,
      userId: user.id,
      triggerInput: 30,
    });

    const execution2 = await prisma.execution.findUnique({
      where: { id: exec2 },
    });

    console.log(`✓ Execution created: ${exec2}`);
    console.log(`  Status: ${execution2?.status}`);
    console.log(`  Steps executed: ${(execution2?.steps as any[])?.length || 0}`);

    const steps2 = (execution2?.steps as any[]) || [];
    for (const step of steps2) {
      console.log(
        `    - ${step.nodeId} (${step.nodeType}): ${step.status}${
          step.status === "success" && step.output
            ? ` → ${JSON.stringify(step.output)}`
            : ""
        }`
      );
    }

    // Verify: should have 2 steps (trigger, if), slack should not execute
    const slackStep = steps2.find((s) => s.nodeId === "slack_1");
    if (
      steps2.length === 2 &&
      steps2[0].status === "success" &&
      steps2[1].status === "success" &&
      !slackStep
    ) {
      console.log("✅ PASS: Only trigger and if executed, slack was skipped");
    } else {
      console.log("❌ FAIL: Expected 2 steps (trigger, if), slack should not execute");
    }

    // Test backward compatibility: linear workflow (no branching)
    console.log("\n📌 Test Case 3: Linear workflow (backward compatibility)");
    const linearDef: WorkflowDefinition = {
      nodes: [
        {
          id: "trigger_1",
          type: "gmail.trigger.newEmail",
          config: { label: "Linear Test Trigger" },
        },
        {
          id: "slack_1",
          type: "slack.action.sendMessage",
          config: {
            channel: "#notifications",
            message: "New email received!",
          },
        },
      ],
      edges: [
        {
          from: "trigger_1",
          to: "slack_1",
        },
      ],
    };

    const linearWorkflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: "Test Linear Workflow (v1 compatible)",
        status: "ACTIVE",
        definition: linearDef as any,
      },
    });

    const exec3 = await runWorkflow({
      workflowId: linearWorkflow.id,
      userId: user.id,
      triggerInput: { from: "test@example.com", subject: "Test" },
    });

    const execution3 = await prisma.execution.findUnique({
      where: { id: exec3 },
    });

    const steps3 = (execution3?.steps as any[]) || [];
    if (
      steps3.length === 2 &&
      steps3.every((s) => s.status === "success")
    ) {
      console.log("✅ PASS: Linear workflow executed successfully (v1 backward compatible)");
    } else {
      console.log("❌ FAIL: Linear workflow failed");
    }

    // Cleanup
    await prisma.user.delete({
      where: { id: user.id },
    });

    console.log("\n✅ All tests completed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testBranchingWorkflow();
