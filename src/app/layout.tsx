// Root layout — delegates to [locale]/layout.tsx via next-intl middleware.
// Next.js App Router requires a root layout, but next-intl handles
// the actual HTML shell in the [locale] layout.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
