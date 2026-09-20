import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import { ThemeModeProvider } from "@/lib/ThemeModeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minerva Calendar Sync",
  description: "Synced calendar events and sync status.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ThemeModeProvider>{children}</ThemeModeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
