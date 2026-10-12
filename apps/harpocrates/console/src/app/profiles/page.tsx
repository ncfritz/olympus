import { Suspense } from "react";
import { ProfilesPage } from "@/components/ProfilesPage";
import { PaddedPage } from "@/components/PaddedPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Profiles() {
  return (
    <PaddedPage>
      <Suspense>
        <ProfilesPage />
      </Suspense>
    </PaddedPage>
  );
}
