import { AntdRegistry } from "@ant-design/nextjs-registry";
import { readShellConfig, ThemeModeProvider } from "@ncfritz/olympus-console";
import type { Metadata } from "next";
import { AppLayout } from "@/components/AppLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minerva Calendar Sync",
  description: "Synced calendar events and sync status.",
};

// Which consoles this host runs is read from the environment at request
// time, not baked into the image (ADR 0021); a prerendered layout would
// carry whatever CONTROL_CONSOLES said on the build machine.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { nav, origin } = readShellConfig();

  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ThemeModeProvider>
            <AppLayout nav={nav} origin={origin}>
              {children}
            </AppLayout>
          </ThemeModeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
