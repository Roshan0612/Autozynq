import { prisma } from "@/lib/prisma";
import { WorkflowDefinition } from "@/lib/workflow/schema";

/**
 * Update workflow with Google Form → AI Email → Gmail demo
 */

const WORKFLOW_ID = "cmk49soa00003lgth1hls37ic";

async function updateWorkflow() {
  console.log(`🔨 Updating workflow ${WORKFLOW_ID}...\n`);

  // Check if workflow exists
  const existing = await prisma.workflow.findUnique({
    where: { id: WORKFLOW_ID },
  });

  if (!existing) {
    throw new Error(`Workflow ${WORKFLOW_ID} not found`);
  }

  console.log(`Found workflow: ${existing.name}`);

  // Extract form ID from the Google Form link
  const formId = "1FAIpQLSeH9Vq4GosuJiCLT0EnzPzOU7da8YGkkaffYk8lUdeJHfzjyw";

  // Define the workflow with 3 nodes
  const definition: WorkflowDefinition = {
    nodes: [
      {
        id: "trigger_form",
        type: "trigger.webhook.basic",
        config: {
          description: "Receives Google Form submission payload via Apps Script webhook",
        },
      },
      {
        id: "ai_email",
        type: "ai.action.generateEmail",
        config: {
          instructions: "Write a warm, friendly thank-you email acknowledging their form submission. Keep it short and professional.",
        },
      },
      {
        id: "smtp_send",
        type: "email.smtp.send",
        config: {
          to: "{{answers.Email}}",
          subject: "{{subject}}",
          body: "{{body}}",
        },
      },
    ],
    edges: [
      { from: "trigger_form", to: "ai_email" },
      { from: "ai_email", to: "smtp_send" },
    ],
    ui: {
      positions: {
        trigger_form: { x: 100, y: 100 },
        ai_email: { x: 400, y: 100 },
        smtp_send: { x: 700, y: 100 },
      },
    },
  };

  // Update workflow
  const updated = await prisma.workflow.update({
    where: { id: WORKFLOW_ID },
    data: {
      name: "Google Form Auto-Reply Demo",
      status: "ACTIVE",
      definition: definition as any,
    },
  });

  console.log(`\n✅ Workflow updated successfully!`);
  console.log(`Workflow ID: ${updated.id}`);
  console.log(`Status: ${updated.status}`);
  console.log(`\n🔗 Open in builder:`);
  console.log(`   http://localhost:3000/workflows/${updated.id}/builder`);
  console.log(`\n🧪 Test execution:`);
  console.log(`   curl -X POST http://localhost:3000/api/workflows/${updated.id}/execute -H "Content-Type: application/json" -d "{}"`);
  console.log(`\n📋 Workflow chain:`);
  console.log(`   Google Form → AI Generate Email → Gmail Send`);
  console.log(`\n💡 The workflow will:`);
  console.log(`   1. Receive form response with email from "Email" field`);
  console.log(`   2. AI generates personalized subject + body`);
  console.log(`   3. Gmail sends to the email address from form (mock)`);
  console.log(`\n📧 Email field: The form must have an "Email" question`);
  console.log(`   Gmail will send to: {{answers.Email}} (dynamic)`);

  return updated;
}

updateWorkflow()
  .catch((error) => {
    console.error("❌ Error updating workflow:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
