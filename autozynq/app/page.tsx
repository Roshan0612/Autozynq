import Navbar from "./components/Navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-6xl font-bold text-center">
            Automate Your Work with Autozynq
          </h1>
          <Button size="lg" asChild>
            <Link href="/dashboard">Get Started Now</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
