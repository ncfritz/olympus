import { AntdRegistry } from "@ant-design/nextjs-registry";
import {
  ControlShell,
  readShellConfig,
  ThemeModeProvider,
} from "@ncfritz/olympus-console";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Olympus Control",
  description: "The consoles of the Olympus platform.",
};

// Which consoles this host runs is read from the environment at request
// time, not baked into the image (ADR 0021).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { nav, origin } = readShellConfig();

  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ThemeModeProvider>
            {/* No `current` and no `auth`: the index is none of the
                consoles, and has no agent to hold a session with. */}
            <ControlShell nav={nav} origin={origin}>
              {children}
            </ControlShell>
          </ThemeModeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
