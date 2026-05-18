import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { encrypt } from "./crypto";
import { supabaseAdmin } from "./supabase";

export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: {
    error: (err) => console.error("[auth] error:", err),
    warn:  (code) => console.warn("[auth] warn:", code),
    debug: (msg, meta) => console.log("[auth] debug:", msg, JSON.stringify(meta ?? {})),
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  adapter:
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? SupabaseAdapter({
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          secret: process.env.SUPABASE_SERVICE_ROLE_KEY,
        })
      : undefined,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user?.id) return true;
      const refreshToken = account.refresh_token as string | undefined;
      const email = (profile?.email as string | undefined) ?? user.email ?? "";
      if (!refreshToken || !email) return true;
      try {
        const db = supabaseAdmin();
        const { error } = await db.from("gmail_accounts").upsert(
          {
            user_id: user.id,
            google_email: email,
            refresh_token_encrypted: encrypt(refreshToken),
          },
          { onConflict: "user_id,google_email" },
        );
        if (error) console.error("gmail_accounts upsert error:", error.message);
      } catch (err) {
        console.error("signIn callback error:", err);
      }
      return true;
    },
    async session({ session, user, token }) {
      try {
        const id = (user as { id?: string } | undefined)?.id ?? (token as { sub?: string } | undefined)?.sub;
        if (session.user && id) (session.user as { id?: string }).id = id;
      } catch (err) {
        console.error("[auth] session callback error:", err);
      }
      return session;
    },
  },
});
