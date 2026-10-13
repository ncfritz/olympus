"use client";

import { Tooltip } from "antd";
import { usePrincipals } from "@/lib/api/queries";
import { principalName } from "@/lib/principals";

/**
 * Who did something, by name: a person's email rather than their ID, the
 * recorded principal on hover.
 */
export function PrincipalName({ principal }: { principal: string }) {
  const { data: emails } = usePrincipals();
  return (
    <Tooltip title={principal}>
      <span>{principalName(principal, emails)}</span>
    </Tooltip>
  );
}
