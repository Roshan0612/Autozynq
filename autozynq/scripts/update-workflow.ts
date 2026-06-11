import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WORKFLOW_ID = "cmk41qnlj0001185k27xtzuob";

async function main() {
  console.log(`Updating workflow ${WORKFLOW_ID} with dummy data...`);

  const workflow = await prisma.workflow.findUnique({ where: { id: WORKFLOW_ID } });
  if (!workflow) {
    console.error("❌ Workflow not found. Check the ID.");
    process.exit(1);
  }

  const updated = await prisma.workflow.update({
    where: { id: WORKFLOW_ID },
    data: {
      name: workflow.name || "Demo Workflow",
      status: "ACTIVE",
      definition: {
        nodes: [
          {
            id: "node_webhook",
            type: "trigger.webhook.basic",
            nodeType: "trigger.webhook.basic",
            category: "trigger",
            position: { x: 120, y: 140 },
            config: { description: "Webhook trigger" },
          },
          {
            id: "node_condition",
            type: "logic.condition",
            nodeType: "logic.condition",
            category: "logic",
            position: { x: 360, y: 140 },
            config: { operator: "equals", value: "ready" },
          },
          {
            id: "node_ai",
            type: "ai.action.generateText",
            nodeType: "ai.action.generateText",
            category: "action",
            position: { x: 600, y: 140 },
            config: {
              provider: "gemini",
              model: "gemini-1.5-flash",
              prompt: "Summarize input: {{input}}",
              temperature: 0.6,
            },
          },
          {
            id: "node_slack",
            type: "slack.action.sendMessage",
            nodeType: "slack.action.sendMessage",
            category: "action",
            position: { x: 840, y: 140 },
            config: { channel: "#general", message: "{{response}}" },
          },
          {
            id: "node_log",
            type: "action.log.debug",
            nodeType: "action.log.debug",
            category: "action",
            position: { x: 1080, y: 140 },
            config: { message: "Finished", level: "info" },
          },
        ],
        edges: [
          { id: "edge_1", from: "node_webhook", to: "node_condition", condition: "true" },
          { id: "edge_2", from: "node_condition", to: "node_ai", condition: "payload.status === 'ready'" },
          { id: "edge_3", from: "node_ai", to: "node_slack", condition: "" },
          { id: "edge_4", from: "node_slack", to: "node_log", condition: "" },
        ],
      },
    },
  });

  console.log("✅ Updated workflow:", updated.id);
  console.log("Name:", updated.name);
  console.log("Status:", updated.status);
  const def = updated.definition as any;
  console.log("Nodes:", def.nodes.length, "Edges:", def.edges.length);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
