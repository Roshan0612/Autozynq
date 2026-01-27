import { prisma } from "../lib/prisma";

async function main() {
  // Find the "google sheet" workflow
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

  console.log("=== Workflow Info ===");
  console.log("ID:", workflow.id);
  console.log("Name:", workflow.name);
  console.log("Status:", workflow.status);
  console.log("User ID:", workflow.userId);
  console.log("\n=== Workflow Definition ===");
  console.log(JSON.stringify(workflow.definition, null, 2));

  // Parse and analyze
  const def = workflow.definition as any;
  console.log("\n=== Analysis ===");
  console.log(`Nodes (${def.nodes?.length || 0}):`);
  def.nodes?.forEach((node: any) => {
    console.log(`  - ${node.id}: ${node.type} (category: ${node.category || "unknown"})`);
  });

  console.log(`\nEdges (${def.edges?.length || 0}):`);
  def.edges?.forEach((edge: any) => {
    console.log(`  - ${edge.from} → ${edge.to}${edge.condition ? ` (condition: ${edge.condition})` : ""}`);
  });

  // Calculate in-degree for each node
  const inDegree = new Map<string, number>();
  def.nodes?.forEach((node: any) => inDegree.set(node.id, 0));
  def.edges?.forEach((edge: any) => {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  });

  console.log("\n=== In-Degree (trigger has 0) ===");
  inDegree.forEach((degree, nodeId) => {
    console.log(`  ${nodeId}: ${degree}${degree === 0 ? " ← TRIGGER?" : ""}`);
  });
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
