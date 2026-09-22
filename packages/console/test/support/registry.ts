import type { Registry } from "../../src/registry";

/** Two properties and three consoles: enough to see grouping and order. */
export const testRegistry: Registry = [
  {
    key: "olympus",
    label: "Olympus",
    consoles: [
      { key: "notifications", label: "Notifications", description: "Relays" },
      { key: "ca", label: "CA", description: "Certificates" },
    ],
  },
  {
    key: "minerva",
    label: "Minerva",
    consoles: [
      { key: "calendar", label: "Calendar", description: "Calendar sync" },
    ],
  },
];
