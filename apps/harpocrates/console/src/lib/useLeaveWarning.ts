import { useEffect } from "react";

/**
 * Asks before the page is left while it holds something that exists
 * nowhere else: an offline CA's key, the signer's unseal key.
 */
export const useLeaveWarning = (holding: boolean): void => {
  useEffect(() => {
    if (!holding) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [holding]);
};
