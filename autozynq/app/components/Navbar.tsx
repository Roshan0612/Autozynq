"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">A</span>
            </div>
            <span className="font-semibold text-xl">Autozynq</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            {/* Dashboard first with icon */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link 
              href="/product" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Product
            </Link>
            <Link 
              href="/pricing" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link 
              href="/clients" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clients
            </Link>
            <Link 
              href="/resources" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Resources
            </Link>
            <Link 
              href="/documentation" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Documentation
            </Link>
            <Link 
              href="/enterprises" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Enterprises
            </Link>
          </div>
        </div>

        {/* Dashboard Button */}
        <div className="flex items-center gap-4">
          {session ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/api/auth/signin">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
