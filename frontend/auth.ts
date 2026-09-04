import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Adapter } from "next-auth/adapters";

const hasDb = Boolean(process.env.DATABASE_URL);

let adapter: Adapter | undefined;
if (hasDb) {
  const { DrizzleAdapter } = require("@auth/drizzle-adapter");
  const { db } = require("@/lib/db");
  const { users, accounts } = require("@/lib/db/schema");
  adapter = DrizzleAdapter(db, { usersTable: users, accountsTable: accounts });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!hasDb) return null;
        const { db } = require("@/lib/db");
        const { users } = require("@/lib/db/schema");
        const { eq } = require("drizzle-orm");
        const bcrypt = require("bcryptjs");

        const email = credentials.email as string;
        const password = credentials.password as string;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.passwordHash) return null;
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});