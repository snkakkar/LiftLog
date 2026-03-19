import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Providers } from "@/components/providers";
import { HeaderAuth } from "@/components/header-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "LiftLog",
  description: "Personal workout logging",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.isAdmin;

  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen`}
      >
        <Providers>
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-primary">
              LiftLog
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Programs
              </Link>
              <Link
                href="/history"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                History
              </Link>
              <Link
                href="/import"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Import
              </Link>
              <Link
                href="/profile"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Profile
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Admin
                </Link>
              )}
              <HeaderAuth />
            </nav>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 pb-24">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
