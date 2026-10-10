import { Suspense } from "react";
import { IssuerPage } from "@/components/IssuerPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Ca() {
  return (
    <Suspense>
      <IssuerPage />
    </Suspense>
  );
}
