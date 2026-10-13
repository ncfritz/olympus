import { Suspense } from "react";
import { SshCasPage } from "@/components/ssh/cas/SshCasPage";

// It reads its tab from its query (useSearchParams), which needs a
// Suspense boundary.
export default function SshCas() {
  return (
    <Suspense>
      <SshCasPage />
    </Suspense>
  );
}
