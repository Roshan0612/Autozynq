"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    router.push("/api/auth/signin");
    return <div>Redirecting to login...</div>;
  }

  return (
    <div>
      <h1>Autozynq Dashboard</h1>
      <p>Logged in as: {session?.user?.email}</p>
      <button onClick={() => signOut()}>Logout</button>
    </div>
  );
}
