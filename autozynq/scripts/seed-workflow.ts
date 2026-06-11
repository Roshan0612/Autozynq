import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with test workflow...");

  // First, find or create a test user
  let user = await prisma.user.findFirst({
    where: { email: "test@example.com" },
  });

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

  // Create a test workflow with dummy definition
  const workflow = await prisma.workflow.create({
    data: {
      name: "Test Email Notification Workflow",
      userId: user.id,
      status: "DRAFT",
      definition: {
        nodes: [
          {
            id: "node_abc123",
            nodeType: "webhook.basic",
            category: "trigger",
            position: { x: 100, y: 100 },
            config: {
              description: "Webhook trigger for emails",
            },
          },
          {
            id: "node_def456",
            nodeType: "condition",
            category: "logic",
            position: { x: 300, y: 100 },
            config: {
              operator: "equals",
              value: "important",
            },
          },
          {
            id: "node_ghi789",
            nodeType: "ai.generateText",
            category: "action",
            position: { x: 500, y: 100 },
            config: {
              provider: "gemini",
              model: "gemini-1.5-flash",
              prompt: "Generate a professional email response for: {{input}}",
              temperature: 0.7,
            },
          },
          {
            id: "node_jkl012",
            nodeType: "sendMessage.slack",
            category: "action",
            position: { x: 700, y: 100 },
            config: {
              channel: "#notifications",
              message: "{{response}}",
            },
          },
          {
            id: "node_mno345",
            nodeType: "log.debug",
            category: "action",
            position: { x: 900, y: 100 },
            config: {
              message: "Workflow completed successfully",
              level: "info",
            },
          },
        ],
        edges: [
          {
            id: "edge_1",
            from: "node_abc123",
            to: "node_def456",
            condition: "payload.type === 'email'",
          },
          {
            id: "edge_2",
            from: "node_def456",
            to: "node_ghi789",
            condition: "true",
          },
          {
            id: "edge_3",
            from: "node_ghi789",
            to: "node_jkl012",
            condition: "",
          },
          {
            id: "edge_4",
            from: "node_jkl012",
            to: "node_mno345",
            condition: "",
          },
        ],
      },
    },
  });

  console.log("✅ Test workflow created:", {
    id: workflow.id,
    name: workflow.name,
    userId: workflow.userId,
    status: workflow.status,
  });

  // Log workflow definition structure
  console.log("\n📋 Workflow Definition:");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = workflow.definition as any;
  console.log("Nodes:", def.nodes.length);
  console.log("Edges:", def.edges.length);

  def.nodes.forEach((node: any) => {
    console.log(
      `  - ${node.id}: ${node.nodeType} (${node.category}) at ${node.position.x},${node.position.y}`
    );
  });

  def.edges.forEach((edge: any) => {
    console.log(`  - ${edge.id}: ${edge.from} → ${edge.to}`);
  });

  console.log("\n✨ Seed complete! Use workflow ID:", workflow.id);
  console.log("Update the URL to: /workflows/" + workflow.id + "/builder");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
