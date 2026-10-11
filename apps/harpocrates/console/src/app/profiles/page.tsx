import { Suspense } from "react";
import { ProfilesPage } from "@/components/ProfilesPage";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function Profiles() {
  return (
    <Suspense>
      <ProfilesPage />
    </Suspense>
  );
}
