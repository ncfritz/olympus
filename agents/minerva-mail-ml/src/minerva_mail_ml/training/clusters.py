"""Clusters of mail by what it is about (docs/plans/email-management phase
6; ADR 0030): groups of messages near one another by embedding, found by
HDBSCAN, a map of the mailbox to draw them on, and what they suggest.

Two kinds of cluster:

- **Unlabelled mail**: what has no label, grouped. A group of some size
  from a tight set of senders is mail that wants a label of its own: a
  new-label suggestion, named after its senders.
- **Within a large label**: a label's mail, grouped. A label whose mail
  falls into two or more sizeable groups from different senders mixes
  kinds of mail: a split suggestion, a sub-label for each group.

The vectors are reduced to PCA_DIMS first (density in 384 dimensions is
thin), and HDBSCAN runs on a sample of at most SAMPLE messages per scope;
the rest join the nearest cluster within its usual radius, or none. The
map is t-SNE over a sample of about one message in POINT_EVERY.
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field

import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE

from minerva_mail_ml.features.embed import dequantize
from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.olympus_api import ApiError, OlympusApi
from minerva_mail_ml.training import dataset as ds

logger = logging.getLogger(__name__)

PCA_DIMS = 32
SAMPLE = 20_000
# The smallest group worth calling a cluster.
MIN_CLUSTER = 25
# A label with at least this many messages is clustered within.
SPLIT_MIN_LABEL = 300
# A split needs groups of at least this share of the label each.
SPLIT_MIN_SHARE = 0.1
# A new label needs this many messages, its top three senders' domains
# covering this share of them.
NEW_LABEL_MIN = 30
NEW_LABEL_SENDER_SHARE = 0.8
# The map: a point per about this many messages, within these bounds.
POINT_EVERY = 50
MIN_POINTS = 2_000
MAX_POINTS = 6_000
TOP = 5
# What the API takes in one post.
CLUSTER_BATCH = 500
ITEM_BATCH = 5_000


class ClusterError(Exception):
    """Why an account could not be clustered; nothing is posted."""


@dataclass
class Cluster:
    number: int
    # "unlabelled", or "label" (within the label `scope_label`).
    scope: str
    scope_label: str | None
    rows: list[int]
    name: str = ""
    # The share of its messages with its most common label.
    purity: float = 0.0
    labels: list[tuple[str, int]] = field(default_factory=list)
    senders: list[tuple[str, int]] = field(default_factory=list)
    x: float = 0.5
    y: float = 0.5
    # "new-label", "split" or None, and the label it proposes.
    suggestion: str | None = None
    proposed_name: str | None = None

    @property
    def size(self) -> int:
        return len(self.rows)


@dataclass
class ClusterRun:
    clusters: list[Cluster]
    # The map: (row, x, y, cluster number or -1), x and y in [0, 1].
    points: list[tuple[int, float, float, int]]
    messages: int


def _domain(sender: str | None) -> str | None:
    if not sender or "@" not in sender:
        return None
    parts = sender.rsplit("@", 1)[1].split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else parts[0]


def _title(domain: str) -> str:
    """`amazon.com` → `Amazon`: a label name from a sender's domain."""
    return domain.split(".")[0].replace("-", " ").title()


def _group(z: np.ndarray, min_size: int, rng: np.random.Generator) -> np.ndarray:
    """A cluster per row of `z` (-1 for none): HDBSCAN on a sample, the
    rest joining the nearest cluster within its usual radius."""
    n = z.shape[0]
    out = np.full(n, -1, dtype=np.int64)
    if n < max(min_size * 2, 10):
        return out
    sample = rng.choice(n, size=min(n, SAMPLE), replace=False)
    found = HDBSCAN(
        min_cluster_size=min_size, min_samples=min(10, min_size), copy=True
    ).fit(z[sample])
    labels = found.labels_
    out[sample] = labels
    numbers = sorted(set(labels) - {-1})
    if not numbers or n == len(sample):
        return out
    centres = np.vstack([z[sample][labels == k].mean(axis=0) for k in numbers])
    radius = np.array(
        [
            np.quantile(
                np.linalg.norm(z[sample][labels == k] - centres[i], axis=1), 0.9
            )
            for i, k in enumerate(numbers)
        ]
    )
    rest = np.setdiff1d(np.arange(n), sample, assume_unique=False)
    for start in range(0, len(rest), 4096):
        chunk = rest[start : start + 4096]
        d = np.linalg.norm(z[chunk][:, None, :] - centres[None, :, :], axis=2)
        nearest = d.argmin(axis=1)
        close = d[np.arange(len(chunk)), nearest] <= radius[nearest]
        out[chunk[close]] = np.asarray(numbers)[nearest[close]]
    return out


def _describe(
    cluster: Cluster,
    data: ds.Dataset,
    label_names: list[str],
    senders: list[str | None],
) -> None:
    rows = cluster.rows
    counts: Counter[str] = Counter()
    y = data.y[rows].tocsc()
    for j in range(y.shape[1]):
        n = y.indptr[j + 1] - y.indptr[j]
        if n:
            counts[label_names[j]] = int(n)
    cluster.labels = counts.most_common(TOP)
    cluster.purity = (
        cluster.labels[0][1] / cluster.size if cluster.labels and cluster.size else 0.0
    )
    by_sender = Counter(s for s in (senders[r] for r in rows) if s)
    cluster.senders = by_sender.most_common(TOP)
    domains = Counter(d for d in (_domain(senders[r]) for r in rows) if d)
    top_domain = domains.most_common(1)[0][0] if domains else None
    if cluster.scope == "label" and cluster.scope_label:
        cluster.name = (
            f"{cluster.scope_label}: {top_domain}"
            if top_domain
            else cluster.scope_label
        )
    elif cluster.purity >= 0.6 and cluster.labels:
        cluster.name = cluster.labels[0][0]
    else:
        cluster.name = f"Mail from {top_domain}" if top_domain else "Mixed mail"
    if cluster.scope == "unlabelled" and cluster.size >= NEW_LABEL_MIN and domains:
        top3 = sum(n for _, n in domains.most_common(3))
        if top3 / cluster.size >= NEW_LABEL_SENDER_SHARE and top_domain:
            cluster.suggestion = "new-label"
            cluster.proposed_name = _title(top_domain)


def _splits(clusters: list[Cluster], label_size: dict[str, int]) -> None:
    """Marks a label's groups as a split where two or more are sizeable
    and come from different senders; each proposes a sub-label."""
    by_label: dict[str, list[Cluster]] = {}
    for c in clusters:
        if c.scope == "label" and c.scope_label:
            by_label.setdefault(c.scope_label, []).append(c)
    for label, groups in by_label.items():
        big = [
            c
            for c in groups
            if c.size >= max(MIN_CLUSTER, SPLIT_MIN_SHARE * label_size[label])
        ]
        domains = {_domain(c.senders[0][0]) if c.senders else None for c in big}
        if len(big) < 2 or len(domains - {None}) < 2:
            continue
        used: Counter[str] = Counter()
        for c in big:
            domain = _domain(c.senders[0][0]) if c.senders else None
            name = _title(domain) if domain else f"Group {c.number}"
            used[name] += 1
            suffix = f" {used[name]}" if used[name] > 1 else ""
            c.suggestion = "split"
            c.proposed_name = f"{label}/{name}{suffix}"


def _map(z: np.ndarray, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """A sample of rows of `z` and their places on a [0, 1] square."""
    n = z.shape[0]
    size = min(n, max(MIN_POINTS, min(MAX_POINTS, n // POINT_EVERY)))
    sample = np.sort(rng.choice(n, size=size, replace=False))
    if size < 5:
        return sample, np.full((size, 2), 0.5)
    xy = TSNE(
        n_components=2,
        init="pca",
        perplexity=min(30.0, max(2.0, (size - 1) / 3)),
        random_state=0,
    ).fit_transform(z[sample])
    low, high = xy.min(axis=0), xy.max(axis=0)
    return sample, (xy - low) / np.where(high > low, high - low, 1.0)


def target_labels(data: ds.Dataset) -> list[str]:
    """Each target by the label it applies: the topic, or the family's
    initial state."""
    return [
        data.initial_labels[t] if t.startswith("family:") else t.split(":", 1)[1]
        for t in data.targets
    ]


def senders_of(data: ds.Dataset) -> list[str | None]:
    """Each message's sender address, from its sender-history keys."""
    return [
        next((k[5:] for k in keys if k.startswith("from:")), None) for keys in data.keys
    ]


def cluster_dataset(
    data: ds.Dataset,
    label_names: list[str],
    senders: list[str | None],
    seed: int = 0,
) -> ClusterRun:
    """The account's clusters and map, from its messages with a vector.
    `label_names` names each target as a suggestion applies it;
    `senders` gives each message's sender address."""
    if data.vectors is None or data.has_vector is None:
        raise ClusterError("Clustering needs embeddings: none are ready")
    rng = np.random.default_rng(seed)
    rows = np.flatnonzero(data.has_vector)
    if len(rows) < MIN_POINTS // 10:
        return ClusterRun(clusters=[], points=[], messages=len(rows))
    x = dequantize(data.vectors[rows])
    pca = PCA(n_components=min(PCA_DIMS, x.shape[1], len(rows) - 1), random_state=0)
    fit_rows = rng.choice(len(rows), size=min(len(rows), 50_000), replace=False)
    pca.fit(x[fit_rows])
    z = pca.transform(x)
    z /= np.maximum(np.linalg.norm(z, axis=1, keepdims=True), 1e-9)

    clusters: list[Cluster] = []
    # Each dataset row's cluster for the map: a label's own groups win
    # over none, unlabelled mail's are its only ones.
    row_cluster = np.full(len(data), -1, dtype=np.int64)
    labelled = np.asarray(data.y[rows].sum(axis=1)).ravel() > 0

    def add(scope: str, scope_label: str | None, members: np.ndarray) -> None:
        local = z[members]
        min_size = max(MIN_CLUSTER, len(members) // 500)
        groups = _group(local, min_size, rng)
        for k in sorted(set(groups) - {-1}):
            chosen = rows[members[groups == k]]
            cluster = Cluster(
                number=len(clusters),
                scope=scope,
                scope_label=scope_label,
                rows=[int(r) for r in chosen],
            )
            row_cluster[chosen] = cluster.number
            clusters.append(cluster)

    add("unlabelled", None, np.flatnonzero(~labelled))
    y = data.y[rows].tocsc()
    label_size: dict[str, int] = {}
    for j in range(y.shape[1]):
        # A family's mail is one kind in different states: never split.
        if not data.targets[j].startswith("topic:"):
            continue
        members = y.indices[y.indptr[j] : y.indptr[j + 1]]
        if len(members) >= SPLIT_MIN_LABEL:
            label_size[label_names[j]] = len(members)
            add("label", label_names[j], np.sort(members))
    for c in clusters:
        _describe(c, data, label_names, senders)
    _splits(clusters, label_size)

    sample, xy = _map(z, rng)
    points = [
        (int(rows[i]), float(xy[k, 0]), float(xy[k, 1]), int(row_cluster[rows[i]]))
        for k, i in enumerate(sample)
    ]
    placed: dict[int, list[tuple[float, float]]] = {}
    for _, px, py, c in points:
        if c >= 0:
            placed.setdefault(c, []).append((px, py))
    for c in clusters:
        if c.number in placed:
            c.x, c.y = (float(v) for v in np.mean(placed[c.number], axis=0))
    logger.info(
        "%d clusters (%d suggesting a new label, %d a split) over %d messages",
        len(clusters),
        sum(c.suggestion == "new-label" for c in clusters),
        sum(c.suggestion == "split" for c in clusters),
        len(rows),
    )
    return ClusterRun(clusters=clusters, points=points, messages=len(rows))


def _round(value: float) -> float:
    return min(1.0, max(0.0, round(float(value), 4)))


def as_posted(cluster: Cluster) -> dict:
    """A cluster as CreateMailClusters takes it."""
    out: dict = {
        "number": cluster.number,
        "scope": cluster.scope,
        "name": cluster.name[:300],
        "size": cluster.size,
        "purity": _round(cluster.purity),
        "x": _round(cluster.x),
        "y": _round(cluster.y),
        "labels": [{"label": n, "messages": m} for n, m in cluster.labels],
        "senders": [{"sender": s[:1024], "messages": m} for s, m in cluster.senders],
    }
    if cluster.scope_label:
        out["scopeLabel"] = cluster.scope_label
    if cluster.suggestion and cluster.proposed_name:
        out["suggestion"] = cluster.suggestion
        out["proposedName"] = cluster.proposed_name[:225]
    return out


def cluster_account(
    store: FeatureStore, api: OlympusApi, account_id: str, seed: int = 0
) -> tuple[str, ClusterRun]:
    """Clusters the account's mail by its serving embeddings, posted to the
    API and published; (cluster run ID, the run)."""
    version = store.serving_version()
    embedding_version = store.serving_embeddings()
    if version is None or embedding_version is None:
        raise ClusterError(
            "Clustering needs features and embeddings ready: featurize the"
            " archive with --embed first"
        )
    data = ds.build(
        store,
        version,
        account_id,
        api.examples(account_id),
        api.labels(account_id),
        embedding_version=embedding_version,
    )
    found = cluster_dataset(data, target_labels(data), senders_of(data), seed=seed)
    run_id = api.create_cluster_run(account_id, embedding_version)
    stored = skipped = 0
    for start in range(0, len(found.clusters), CLUSTER_BATCH):
        created, left_out = api.create_clusters(
            run_id,
            [as_posted(c) for c in found.clusters[start : start + CLUSTER_BATCH]],
        )
        stored += created
        skipped += left_out
    for c in found.clusters:
        ids = [data.gmail_ids[r] for r in c.rows]
        try:
            for start in range(0, len(ids), ITEM_BATCH):
                api.create_cluster_members(
                    run_id, c.number, ids[start : start + ITEM_BATCH]
                )
        except ApiError as error:
            # A label's cluster whose label went since the labels were read
            # was skipped; it has no members to post.
            if error.status != 404:
                raise
    points = [
        {
            "gmailId": data.gmail_ids[row],
            "x": _round(x),
            "y": _round(y),
            **({"cluster": number} if number >= 0 else {}),
        }
        for row, x, y, number in found.points
    ]
    for start in range(0, len(points), ITEM_BATCH):
        api.create_cluster_points(run_id, points[start : start + ITEM_BATCH])
    api.publish_cluster_run(run_id, found.messages)
    logger.info(
        "Cluster run %s published: %d clusters (%d skipped by the API),"
        " %d points over %d messages",
        run_id,
        stored,
        skipped,
        len(points),
        found.messages,
    )
    return run_id, found
