"use client";

import { PemInput } from "./PemInput";

export interface KeyFileInputProps {
  value?: string;
  onChange?: (pem: string | undefined) => void;
}

/**
 * An offline CA's encrypted key, dropped or chosen from the offline media
 * and read in the browser. Its text goes to the service in the request
 * that opens the ceremony, and nowhere else.
 */
export function KeyFileInput({ value, onChange }: KeyFileInputProps) {
  return <PemInput kind="key" rows={3} value={value} onChange={onChange} />;
}
