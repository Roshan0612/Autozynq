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
      displayName: node.displayName,
      description: node.description,
    };
  });

  return NextResponse.json({ nodes });
}
