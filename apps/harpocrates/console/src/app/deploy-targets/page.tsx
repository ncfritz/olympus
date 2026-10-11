import { Suspense } from "react";
import { DeployTargetsPage } from "@/components/DeployTargetsPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function DeployTargets() {
  return (
    <Suspense>
      <DeployTargetsPage />
    </Suspense>
  );
}
