import { Suspense } from "react";
import { CeremonyPage } from "@/components/CeremonyPage";
import { PaddedPage } from "@/components/PaddedPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Ceremony() {
  return (
    <PaddedPage>
      <Suspense>
        <CeremonyPage />
      </Suspense>
    </PaddedPage>
  );
}
