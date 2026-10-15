# 0040. Harpocrates: an imported CA's hierarchy is free-form

- **Status:** Accepted
- **Date:** 2026-10-15; accepted 2026-10-15 (Neil)
- **Amends:** [ADR 0032](0032-harpocrates-roots-and-migration.md) (Three
  shapes), [ADR 0037](0037-harpocrates-xca-imported-for-the-record.md)

## Context

A root made here is given a shape when it is created (ADR 0032): three
tiers, two tiers, or signing directly. The shape sets the root's path
length and what its ceremonies sign, and the console reads it to say
what a CA signs and to offer what may be made beneath it.

An imported root was given the shape its path length suggested. That
is a guess: XCA did not hold its hierarchy to any shape, and its roots
and intermediates may have signed CAs and certificates side by side.
Taking the guess as a rule keeps the console from importing what the
root actually signed, and its page says it signs something it may not.

## Decision

- **An imported root has no shape.** Harpocrates did not choose its
  hierarchy, so it records none; roots imported before lose the shape
  they were given (a migration).
- **What is beneath an imported CA is taken as it comes.** Its page
  imports both a child CA and a certificate it signed directly, for a
  root and an intermediate alike; the import checks only that the CA
  here signed it (its signature, ADR 0037), not that the tier is the
  one a shape would expect. Its page says it signs "anything beneath
  it".
- **Roots made here are unchanged.** Their shape still sets their path
  length, what their ceremonies sign and what the console offers.

## Consequences

- XCA's hierarchy is recorded as it is, including certificates its
  root or intermediates signed directly.
- An imported root's ceremonies (its lists, signed with its key brought
  from the offline media) sign as a root with no shape does: the
  default, intermediate CAs. Signing new CAs or leaves under an
  imported root is not something the migration asks for; it would need
  a decision of its own.
- The roots page's shape filter and tag leave imported roots out.
