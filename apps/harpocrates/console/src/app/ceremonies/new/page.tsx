import { Suspense } from "react";
import { OpenCeremonyPage } from "@/components/OpenCeremonyPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function OpenCeremony() {
  return (
    <Suspense>
      <OpenCeremonyPage />
    </Suspense>
  );
}
