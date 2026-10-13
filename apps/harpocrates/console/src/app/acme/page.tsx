import { Suspense } from "react";
import { AcmePage } from "@/components/acme/AcmePage";

// It reads its tab and the open client from its query (useSearchParams),
// which needs a Suspense boundary.
export default function Acme() {
  return (
    <Suspense>
      <AcmePage />
    </Suspense>
  );
}
