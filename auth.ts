import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = sql();
        const rows = await db`SELECT * FROM users WHERE email = ${credentials.email as string} LIMIT 1`;
        const user = rows[0];
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.password as string);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email as string,
          name: user.name as string,
          role: user.role as string,
        };
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      // 古いトークンにroleがない場合はDBから取り直す
      if (!token.role && token.id) {
        try {
          const db = sql();
          const rows = await db`SELECT role FROM users WHERE id = ${token.id as string} LIMIT 1`;
          if (rows.length) token.role = rows[0].role as string;
        } catch {
          // DB接続エラー時は何もしない
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "sales";
      }
      return session;
    },
  },
});
