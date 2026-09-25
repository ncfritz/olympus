"""Harpocrates's signer: the one process that holds the CA's private keys.

It generates keys and signs certificates and revocation lists from fully
formed requests, enforcing its own invariants; the Harpocrates service
decides everything else (ADR 0020).
"""
