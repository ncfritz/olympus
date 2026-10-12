import { Suspense } from "react";
import { AcmePage } from "@/components/AcmePage";
import { PaddedPage } from "@/components/PaddedPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Acme() {
  return (
    <PaddedPage>
      <Suspense>
        <AcmePage />
      </Suspense>
    </PaddedPage>
  );
}
