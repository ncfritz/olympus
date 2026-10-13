import { Suspense } from "react";
import { CertificatePage } from "@/components/certificate/CertificatePage";

// It reads the certificate and its tab from its query (useSearchParams),
// which needs a Suspense boundary.
export default function Certificate() {
  return (
    <Suspense>
      <CertificatePage />
    </Suspense>
  );
}
