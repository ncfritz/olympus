import { Suspense } from "react";
import { RootsPage } from "@/components/roots/RootsPage";

// It reads its tab from its query (useSearchParams): a Suspense boundary.
export default function Roots() {
  return (
    <Suspense>
      <RootsPage />
    </Suspense>
  );
}
