import { Suspense } from "react";
import { DeployTargetsPage } from "@/components/DeployTargetsPage";
import { PaddedPage } from "@/components/PaddedPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function DeployTargets() {
  return (
    <PaddedPage>
      <Suspense>
        <DeployTargetsPage />
      </Suspense>
    </PaddedPage>
  );
}
