"use client";

import { Result } from "antd";
import { useEffect } from "react";
import { announceSignedIn } from "@/lib/recentSignIn";

/**
 * Where the sign-in window comes back to (signInAgain): it tells the page
 * that opened it, and closes. A browser that will not let it close leaves
 * this to say so.
 */
export function SignedInPage() {
  useEffect(() => {
    announceSignedIn();
    window.close();
  }, []);
  return (
    <Result
      status="success"
      title="Signed in again"
      subTitle="You can close this window: the page you were on has carried on."
    />
  );
}
