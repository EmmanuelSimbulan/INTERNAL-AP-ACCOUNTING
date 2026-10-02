import type { Metadata } from "next";
import "./globals.css";
import "./prototype.css";

export const metadata: Metadata = { title: "Internal Accounts Payable Workflow System", description: "Secure request-to-payment workflow" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
