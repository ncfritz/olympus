import { Suspense } from "react";
import { CeremonyPage } from "@/components/CeremonyPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Ceremony() {
  return (
    <Suspense>
      <CeremonyPage />
    </Suspense>
  );
}
