import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Autonomous AI Creator",
  description: "An autonomous AI & technology persona that discovers, judges, writes, and publishes on its own.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
