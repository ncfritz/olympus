import { Suspense } from "react";
import { SshCertificatesPage } from "@/components/ssh/certificates/SshCertificatesPage";

// It reads its tab and the open certificate from its query
// (useSearchParams), which needs a Suspense boundary.
export default function SshCertificates() {
  return (
    <Suspense>
      <SshCertificatesPage />
    </Suspense>
  );
}
