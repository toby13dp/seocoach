import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

/**
 * Hash a plaintext password using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hashed: string
): Promise<boolean> {
  return compare(password, hashed);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

interface RegisterUserInput {
  email: string;
  password: string;
  name?: string;
  locale?: string;
}

/**
 * Create a new user with a hashed password and auto-create UserSettings.
 * Throws if the email is already taken.
 */
export async function registerUser(input: RegisterUserInput) {
  const { email, password, name, locale = "nl-NL" } = input;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const hashedPassword = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      name: name ?? null,
      hashedPassword,
      locale,
      settings: {
        create: {
          locale,
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
    },
  });

  return user;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

interface AuthenticateUserResult {
  id: string;
  email: string;
  name: string | null;
  locale: string;
}

/**
 * Validate email/password credentials.
 * Returns the user object on success or `null` on failure.
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthenticateUserResult | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      hashedPassword: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt || !user.hashedPassword) {
    return null;
  }

  const valid = await verifyPassword(password, user.hashedPassword);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
  };
}

// ---------------------------------------------------------------------------
// NextAuth options
// ---------------------------------------------------------------------------

export const authOptions: NextAuthOptions = {
  providers: [
    // Google OAuth provider — only enabled if credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                scope: "openid email profile",
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await authenticateUser(
          credentials.email,
          credentials.password
        );

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          locale: user.locale,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign-in — auto-create user if first time
      if (account?.provider === "google" && user.email) {
        try {
          const existingUser = await db.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // Create user automatically on first Google sign-in
            const newUser = await db.user.create({
              data: {
                email: user.email,
                name: user.name ?? null,
                image: user.image ?? null,
                locale: "nl-NL",
                settings: {
                  create: { locale: "nl-NL" },
                },
              },
            });
            // Update the user id so it flows into the JWT
            user.id = newUser.id;
          } else {
            // Update existing user with latest Google info
            await db.user.update({
              where: { id: existingUser.id },
              data: {
                name: user.name ?? existingUser.name,
                image: user.image ?? existingUser.image,
              },
            });
            user.id = existingUser.id;
          }
        } catch (err) {
          console.error("Google sign-in user sync failed:", err);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // On sign-in the `user` object is available – persist extra fields in the token.
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name ?? undefined;
        token.locale = (user as { locale?: string }).locale ?? "nl-NL";
      }
      // Persist Google access/refresh tokens for API calls
      if (account?.provider === "google") {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose token fields on the session `user` object.
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        (session.user as { locale?: string }).locale =
          token.locale as string;
        (session.user as { accessToken?: string }).accessToken =
          token.accessToken as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me-in-production",
};
