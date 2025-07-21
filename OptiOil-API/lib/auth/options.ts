import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma"; // Adjusted the path to use an alias if applicable
import { Adapter } from "next-auth/adapters";
import { compare } from "bcryptjs"; // ✅ ここを追加！

const db = prisma; 

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const passwordValid = await compare(credentials.password, user.password); // ✅ ハッシュ比較

        if (!passwordValid) return null;

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = user.id;   
      }
      return token;
    },
    async session({ session, token }) {
      if ((token as any)?.id) {
        (session.user as any).id = (token as any).id;
      }
      return session;
    },
  },  
  secret: process.env.NEXTAUTH_SECRET,
};