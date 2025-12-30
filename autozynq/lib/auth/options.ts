import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Session } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "../prisma";

type MinimalUser = { id?: string };
type MinimalSession = { user?: MinimalUser & Record<string, unknown> };

// Central auth options so API routes and NextAuth share the same configuration.
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID as string,
      clientSecret: process.env.GOOGLE_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "database" as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, user }: { session: Session; user: AdapterUser }) {
      const sUser = session.user as MinimalSession["user"];
      if (sUser && user.id) {
        sUser.id = user.id;
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
};
