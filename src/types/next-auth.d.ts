import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image?: string | null;
      locale?: string;
      accessToken?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string | null;
    locale?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    locale: string;
    accessToken?: string;
    refreshToken?: string;
  }
}
