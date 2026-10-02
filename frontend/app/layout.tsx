import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/auth-provider";
import { CategoriesProvider } from "@/components/providers/categories-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { PreferencesProvider } from "@/lib/preferences";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Personal Finance Advisor",
  description: "PKR-focused AI personal finance advisor dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <PreferencesProvider>
          <AuthProvider>
            <CategoriesProvider>
              <UserProvider>
                {children}
                <Toaster richColors position="top-right" />
              </UserProvider>
            </CategoriesProvider>
          </AuthProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
