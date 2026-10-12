import { Suspense } from "react";
import { SshCertificatesPage } from "@/components/ssh/SshCertificatesPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function SshCertificates() {
  return (
    <Suspense>
      <SshCertificatesPage />
    </Suspense>
  );
}
