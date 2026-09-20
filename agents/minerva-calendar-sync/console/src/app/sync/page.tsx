import { Suspense } from "react";
import { SyncHistoryPage } from "@/components/SyncHistoryPage";

export default function Sync() {
  return (
    <Suspense>
      <SyncHistoryPage />
    </Suspense>
  );
}
