import { Suspense } from "react";
import { CertificatesPage } from "@/components/CertificatesPage";
import { PaddedPage } from "@/components/PaddedPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Certificates() {
  return (
    <PaddedPage>
      <Suspense>
        <CertificatesPage />
      </Suspense>
    </PaddedPage>
  );
}
