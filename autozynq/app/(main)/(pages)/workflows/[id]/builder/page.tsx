import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { WorkflowStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import type { WorkflowDefinition } from "@/lib/workflow/schema";
import WorkflowBuilderClient from "./WorkflowBuilderClient";

interface BuilderPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuilderPage({ params }: BuilderPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  const user = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!user) {
    redirect("/api/auth/signin");
  }

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.id },
  });

  if (!workflow) {
    notFound();
  }

  const definition = workflow.definition as WorkflowDefinition;

  return (
    <WorkflowBuilderClient
      workflowId={workflow.id}
      workflowName={workflow.name}
      initialDefinition={definition}
      initialStatus={workflow.status as WorkflowStatus}
    />
  );
}
