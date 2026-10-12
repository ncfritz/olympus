import { Suspense } from "react";
import { ImportPage } from "@/components/roots/ImportPage";

// It reads its tab and CA from its query (useSearchParams): a Suspense
// boundary.
export default function Import() {
  return (
    <Suspense>
      <ImportPage />
    </Suspense>
  );
}
