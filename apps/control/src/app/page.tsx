import { readShellConfig } from "@ncfritz/olympus-console";
import { ConsoleIndex } from "@/components/ConsoleIndex";

export default function Home() {
  const { nav, origin } = readShellConfig();

  return <ConsoleIndex nav={nav} origin={origin} />;
}
