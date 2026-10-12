import { Suspense } from "react";
import { SshCertificatesPage } from "@/components/ssh/SshCertificatesPage";
import { PaddedPage } from "@/components/PaddedPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function SshCertificates() {
  return (
    <PaddedPage>
      <Suspense>
        <SshCertificatesPage />
      </Suspense>
    </PaddedPage>
  );
}
