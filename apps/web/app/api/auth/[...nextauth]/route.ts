import NextAuth, { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'cmejdqwwq0005bokozpgap0kj';

export const authOptions: NextAuthOptions = {
  providers: [
    // --- Magic Link provider (your original) ---
    Credentials({
      id: 'credentials',
      name: 'Magic Link',
      credentials: { token: { label: 'Token', type: 'text' } },
      async authorize(creds) {
        const token = (creds?.token as string) || '';
        if (!token) return null;

        const res = await fetch(`${API_URL}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.user || !data?.token) return null;

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          tenantId: data.user.tenantId,
          apiToken: data.token,
        } as any;
      },
    }),
    // --- Dev provider (no email needed beyond a string, code must be "dev") ---
    Credentials({
      id: 'dev',
      name: 'Dev Login',
      credentials: {
        email: { label: 'Email', type: 'text' },
        code: { label: 'Code', type: 'password' },
      },
      async authorize(creds) {
        const email = (creds?.email as string) || 'dev@classroomhub.test';
        const code = (creds?.code as string) || '';
        if (code !== 'dev') return null;

        // No backend token needed; proxy will use internal key + tenant
        return {
          id: 'dev-user',
          email,
          name: 'Dev User',
          tenantId: DEFAULT_TENANT_ID,
          apiToken: null,
        } as any;
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id;
        token.tenantId = (user as any).tenantId || DEFAULT_TENANT_ID;
        token.apiToken = (user as any).apiToken || null;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).userId = token.userId;
      (session as any).tenantId = token.tenantId || DEFAULT_TENANT_ID;
      (session as any).apiToken = token.apiToken || null;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };