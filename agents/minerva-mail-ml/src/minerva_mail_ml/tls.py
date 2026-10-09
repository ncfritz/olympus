"""The services listener's TLS: mutual, and only for the services allowed.

The handshake proves the client's chain reaches the services CA (and is
not revoked, when lists are given). It does not say which service it is,
so as each connection opens its certificate's issuer and common name are
checked here, and a connection from anyone else is closed before a byte
of a request is read (ADR 0018, 0023).
"""

from __future__ import annotations

import logging
import ssl
from typing import Any

from uvicorn.protocols.http.h11_impl import H11Protocol

from minerva_mail_ml.config import ServicesTls

logger = logging.getLogger(__name__)


def services_ssl_context(tls: ServicesTls) -> ssl.SSLContext:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(str(tls.cert), str(tls.key))
    context.load_verify_locations(cafile=str(tls.ca))
    for crl in tls.crls:
        context.load_verify_locations(cafile=str(crl))
    if tls.crls:
        context.verify_flags |= ssl.VERIFY_CRL_CHECK_CHAIN
    context.verify_mode = ssl.CERT_REQUIRED
    return context


def _common_name(name: Any) -> str | None:
    for rdn in name or ():
        for key, value in rdn:
            if key == "commonName":
                return value
    return None


def refusal(cert: dict | None, tls: ServicesTls) -> str | None:
    """Why a verified client certificate may not come in, or None."""
    if not cert:
        return "no client certificate"
    issuer = _common_name(cert.get("issuer"))
    if issuer != tls.issuer:
        return f'issuer "{issuer}" is not the services issuer'
    subject = _common_name(cert.get("subject"))
    if subject not in tls.allowed_clients:
        return f'"{subject}" is not allowed here'
    return None


def allowed_clients_protocol(tls: ServicesTls) -> type[H11Protocol]:
    """uvicorn's HTTP/1.1 protocol, refusing other services at connection."""

    class AllowedClientsProtocol(H11Protocol):
        def connection_made(self, transport: Any) -> None:
            ssl_object = transport.get_extra_info("ssl_object")
            cert = ssl_object.getpeercert() if ssl_object is not None else None
            reason = refusal(cert, tls)
            if reason is not None:
                logger.warning("Refused a services connection: %s", reason)
                transport.close()
                return
            super().connection_made(transport)

    return AllowedClientsProtocol
