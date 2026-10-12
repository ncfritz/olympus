import { Suspense } from "react";
import { CertificatesPage } from "@/components/certificates/CertificatesPage";

// It reads its tab and the open certificate from its query
// (useSearchParams), which needs a Suspense boundary.
export default function Certificates() {
  return (
    <Suspense>
      <CertificatesPage />
    </Suspense>
  );
}
