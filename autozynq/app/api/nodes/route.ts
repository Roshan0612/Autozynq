import { getNode, listNodeTypes } from "@/lib/nodes";
import { NextResponse } from "next/server";

// Public API to list all available node types with metadata
export async function GET() {
  const nodeTypes = listNodeTypes();
  
  const nodes = nodeTypes.map((type) => {
    const node = getNode(type);
    return {
      type: node.type,
      category: node.category,
      app: node.app || "Core",
      displayName: node.displayName,
      description: node.description,
      icon: node.icon,
      requiresConnection: node.requiresConnection,
      provider: node.provider,
    };
  });

  return NextResponse.json({ 
    nodes,
    total: nodes.length,
    groupedByApp: nodes.reduce((acc: Record<string, typeof nodes>, node) => {
      const app = node.app || "Core";
      if (!acc[app]) acc[app] = [];
      acc[app].push(node);
      return acc;
    }, {} as Record<string, typeof nodes>)
  });
}

