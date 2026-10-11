import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RESCUE — Study smarter. Respond better.",
  description:
    "Your personal EMT study station. Private notes, focused practice, and a shared class library.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
