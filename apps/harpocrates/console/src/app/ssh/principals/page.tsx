import { Suspense } from "react";
import { SshPrincipalsPage } from "@/components/ssh/principals/SshPrincipalsPage";

// It reads its tab from its query (useSearchParams), which needs a
// Suspense boundary.
export default function SshPrincipals() {
  return (
    <Suspense>
      <SshPrincipalsPage />
    </Suspense>
  );
}
