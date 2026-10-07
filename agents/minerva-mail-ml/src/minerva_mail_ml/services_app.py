"""The services listener's routes: where message text arrives.

Only the mail agent reaches these (tls.py checks its certificate as the
connection opens). Text is featurized in memory and dropped: it is not
stored, logged or echoed back, not even in a validation error.
"""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from prometheus_client import Counter
from pydantic import BaseModel, Field

from minerva_mail_ml import __version__
from minerva_mail_ml.features.featurize import (
    FEATURE_VERSION,
    N_FEATURES,
    MessageText,
    featurize,
)
from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.training.dataset import sender_keys, weigh
from minerva_mail_ml.training.serving import ServingModels

logger = logging.getLogger(__name__)

FEATURES_STORED = Counter(
    "minerva_mail_ml_features_stored_total",
    "Messages featurized and stored, by feature version",
    ["version"],
)

SUGGESTIONS_MADE = Counter(
    "minerva_mail_ml_suggestions_total",
    "Messages given suggestions",
)

MAX_BATCH = 500


class FeatureMessage(BaseModel):
    gmailId: str = Field(pattern=r"^[0-9a-f]{1,16}$")  # noqa: N815
    receivedAt: datetime  # noqa: N815
    subject: str | None = Field(default=None, max_length=10_000)
    text: str | None = Field(default=None, max_length=2_000_000)
    fromAddress: str | None = Field(default=None, max_length=1024)  # noqa: N815
    listId: str | None = Field(default=None, max_length=500)  # noqa: N815
    hasListUnsubscribe: bool = False  # noqa: N815
    attachmentExtensions: list[str] = Field(  # noqa: N815
        default_factory=list, max_length=100
    )


class FeaturesRequest(BaseModel):
    accountId: UUID  # noqa: N815
    # The version the sender is building; it must be this classifier's.
    version: str | None = None
    messages: list[FeatureMessage] = Field(min_length=1, max_length=MAX_BATCH)


class FeaturesResponse(BaseModel):
    version: str
    stored: int


class SuggestionsRequest(BaseModel):
    accountId: UUID  # noqa: N815
    messages: list[FeatureMessage] = Field(min_length=1, max_length=MAX_BATCH)


class SuggestedLabel(BaseModel):
    label: str
    kind: str
    score: float
    threshold: float | None = None
    ticked: bool


class MessageSuggestions(BaseModel):
    gmailId: str  # noqa: N815
    labels: list[SuggestedLabel]


class SuggestionsResponse(BaseModel):
    modelRun: str  # noqa: N815
    featureVersion: str  # noqa: N815
    messages: list[MessageSuggestions]


class CompleteRequest(BaseModel):
    version: str


class VersionResponse(BaseModel):
    version: str
    status: str
    nFeatures: int  # noqa: N815
    messages: int
    createdTime: str  # noqa: N815
    completedTime: str | None = None  # noqa: N815
    serving: bool


def _texts(messages: list[FeatureMessage]) -> list[MessageText]:
    return [
        MessageText(
            subject=m.subject,
            text=m.text,
            from_address=m.fromAddress,
            list_id=m.listId,
            has_list_unsubscribe=m.hasListUnsubscribe,
            attachment_extensions=m.attachmentExtensions,
        )
        for m in messages
    ]


def create_services_app(store: FeatureStore, models: ServingModels) -> FastAPI:
    app = FastAPI(title="minerva-mail-ml services", version=__version__)

    @app.exception_handler(RequestValidationError)
    async def without_input(_: Request, error: RequestValidationError) -> JSONResponse:
        # FastAPI's default answer repeats the input it refused, which here
        # could be a message's text. Say where and why, not what.
        return JSONResponse(
            status_code=422,
            content={
                "detail": [
                    {"loc": e.get("loc"), "msg": e.get("msg"), "type": e.get("type")}
                    for e in error.errors()
                ]
            },
        )

    @app.post("/v1/features", response_model=FeaturesResponse)
    def put_features(request: FeaturesRequest) -> FeaturesResponse:
        if request.version is not None and request.version != FEATURE_VERSION:
            raise HTTPException(
                status_code=409,
                detail=f"This classifier builds features {FEATURE_VERSION}",
            )
        matrix = featurize(_texts(request.messages))
        store.begin_version(FEATURE_VERSION, N_FEATURES)
        stored = store.put(
            FEATURE_VERSION,
            str(request.accountId),
            [
                (
                    m.gmailId,
                    m.receivedAt.isoformat(),
                    m.fromAddress.lower() if m.fromAddress else None,
                    m.listId.lower() if m.listId else None,
                )
                for m in request.messages
            ],
            matrix,
        )
        FEATURES_STORED.labels(FEATURE_VERSION).inc(stored)
        logger.debug("Stored features of %d messages", stored)
        return FeaturesResponse(version=FEATURE_VERSION, stored=stored)

    @app.post("/v1/suggestions", response_model=SuggestionsResponse)
    def suggestions(request: SuggestionsRequest) -> SuggestionsResponse:
        """Labels for messages, from the account's serving model. The text
        is featurized in memory and dropped; nothing is stored."""
        serving = models.get(str(request.accountId))
        if serving is None:
            raise HTTPException(
                status_code=404, detail="No model is trained for this account yet"
            )
        run_id, model = serving
        if model.feature_version != FEATURE_VERSION:
            raise HTTPException(
                status_code=409,
                detail=f"The serving model reads features {model.feature_version},"
                f" this classifier makes {FEATURE_VERSION}",
            )
        x = weigh(featurize(_texts(request.messages)))
        keys = [
            sender_keys(
                m.fromAddress.lower() if m.fromAddress else None,
                m.listId.lower() if m.listId else None,
            )
            for m in request.messages
        ]
        with models.lock(str(request.accountId)):
            found = model.suggest(x, keys)
        SUGGESTIONS_MADE.inc(len(found))
        return SuggestionsResponse(
            modelRun=run_id,
            featureVersion=model.feature_version,
            messages=[
                MessageSuggestions(
                    gmailId=m.gmailId,
                    labels=[
                        SuggestedLabel(
                            label=s.label,
                            kind=s.kind,
                            score=round(s.score, 4),
                            threshold=(
                                round(s.threshold, 4)
                                if s.threshold is not None
                                else None
                            ),
                            ticked=s.ticked,
                        )
                        for s in suggested
                    ],
                )
                for m, suggested in zip(request.messages, found, strict=True)
            ],
        )

    def describe(version: str) -> VersionResponse:
        serving = store.serving_version()
        for v in store.versions():
            if v.version == version:
                return VersionResponse(
                    version=v.version,
                    status=v.status,
                    nFeatures=v.n_features,
                    messages=v.messages,
                    createdTime=v.created_at,
                    completedTime=v.completed_at,
                    serving=v.version == serving,
                )
        raise HTTPException(status_code=404, detail=f"No feature version {version}")

    @app.post("/v1/features/complete", response_model=VersionResponse)
    def complete(request: CompleteRequest) -> VersionResponse:
        """Marks a version built: it serves from now on."""
        if not store.complete(request.version):
            raise HTTPException(
                status_code=404, detail=f"No feature version {request.version}"
            )
        logger.info("Feature version %s complete", request.version)
        return describe(request.version)

    @app.get("/v1/features/versions", response_model=list[VersionResponse])
    def versions() -> list[VersionResponse]:
        return [describe(v.version) for v in store.versions()]

    return app
