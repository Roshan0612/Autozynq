"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/sidebar/Sidebar";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return <div>Redirecting to login...</div>;
  }

  return (
    <div>
      <Navbar />
      <Sidebar />
      <div className="ml-16 container mx-auto px-4 py-8">
        <h1>Autozynq Dashboard</h1>
        <p>Logged in as: {session?.user?.email}</p>
        <button onClick={() => signOut()}>Logout</button>
      </div>
    </div>
  );
}
