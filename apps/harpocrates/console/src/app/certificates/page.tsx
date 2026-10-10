import { Suspense } from "react";
import { CertificatesPage } from "@/components/CertificatesPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Certificates() {
  return (
    <Suspense>
      <CertificatesPage />
    </Suspense>
  );
}
