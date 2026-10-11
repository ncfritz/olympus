import { Suspense } from "react";
import { ProfileEditor } from "@/components/profiles/ProfileEditor";

// It reads its query (useSearchParams), which needs a Suspense boundary.
export default function NewProfile() {
  return (
    <Suspense>
      <ProfileEditor />
    </Suspense>
  );
}
