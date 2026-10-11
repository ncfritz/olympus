import { Suspense } from "react";
import { AcmePage } from "@/components/AcmePage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Acme() {
  return (
    <Suspense>
      <AcmePage />
    </Suspense>
  );
}
