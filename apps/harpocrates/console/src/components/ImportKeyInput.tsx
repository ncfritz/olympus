"use client";

import type { KeyImportFormat } from "@/lib/api/types";
import { PemInput } from "./PemInput";

export interface ImportKeyInputProps {
  format: KeyImportFormat;
  value?: string;
  onChange?: (data: string | undefined) => void;
}

/**
 * A key brought to be certified, read in the browser: encrypted PKCS#8,
 * dropped, chosen or pasted, or a PKCS#12 file (as base64). It goes to the
 * service in the request that issues the certificate, and nowhere else.
 */
export function ImportKeyInput({
  format,
  value,
  onChange,
}: ImportKeyInputProps) {
  return (
    <PemInput
      kind={format === "pkcs12" ? "pkcs12" : "key"}
      value={value}
      onChange={onChange}
    />
  );
}
