"""`minerva-mail-ml-train`: training runs and their reports.

    minerva-mail-ml-train run [--account ID]   train every account, or one
    minerva-mail-ml-train suggest [--account ID]
                                               suggestions over the whole
                                               mailbox, posted to the API
    minerva-mail-ml-train score-inbox [--account ID]
                                               what is to review in the inbox
                                               scored again by the newest model
    minerva-mail-ml-train learn [--account ID] learn from approvals in the
                                               inbox once, as the service does
    minerva-mail-ml-train payments [--account ID]
                                               payment confirmations learned
                                               from matches approved and
                                               declined, the mailbox scored
    minerva-mail-ml-train cluster [--account ID]
                                               clusters of the mail by its
                                               embeddings, and the map, posted
                                               to the API
    minerva-mail-ml-train report [--run ID]    a run's evaluation (default:
                                               each account's newest run)

Runs alone, beside the service: the nightly DAG starts it in the service's
image with the service's volume (infra/airflow/dags). The service picks up
a new model on its next request; nothing needs restarting.
"""

from __future__ import annotations

import argparse
import logging
import sys

from minerva_mail_ml.config import ConfigError, read_config
from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.olympus_api import OlympusApi
from minerva_mail_ml.training.clusters import ClusterError, cluster_account
from minerva_mail_ml.training.online import learn_account, score_inbox
from minerva_mail_ml.training.payments import score_account as score_payments
from minerva_mail_ml.training.pipeline import (
    TrainingError,
    suggest_account,
    train_account,
)
from minerva_mail_ml.training.registry import MACRO_MIN, ModelRegistry, Run
from minerva_mail_ml.training.serving import ServingModels
from minerva_mail_ml.training.suggest import SuggestError

logger = logging.getLogger("minerva_mail_ml.train")


def _pct(value: float | None) -> str:
    return "     - " if value is None else f"{value * 100:5.1f}%"


def report(
    registry: ModelRegistry, run: Run, out=sys.stdout, everything: bool = False
) -> None:
    out.write(
        f"Run {run.id}  account {run.account_id}  features {run.feature_version}\n"
        f"  {run.status}, started {run.started_at}, finished {run.finished_at}\n"
    )
    if run.error:
        out.write(f"  error: {run.error}\n")
    s = run.summary
    if s is None:
        return
    out.write(
        f"  {s.examples} messages: {s.train_examples} training,"
        f" {s.validation_examples} validation from {s.validation_from[:10]},"
        f" {s.test_examples} test from {s.test_from[:10]}\n"
        f"  {s.targets} targets, {s.targets_trained} with a linear model\n"
        f"  At each target's threshold: precision {_pct(s.precision)},"
        f" recall {_pct(s.recall)}, messages with a ticked suggestion"
        f" {_pct(s.coverage)}\n"
        f"  At 0.5 (the baseline):      precision {_pct(s.precision_default)},"
        f" recall {_pct(s.recall_default)}\n"
        f"  Per label ({s.macro_targets} with {MACRO_MIN}+ test messages):"
        f" precision {_pct(s.macro_precision)}, recall {_pct(s.macro_recall)}\n"
        f"  Top suggestion right (labelled test mail): {_pct(s.top_one)}\n"
        + (
            f"  Neighbours: {s.embedding_version}, {s.embedded} of"
            f" {s.examples} messages embedded\n\n"
            if s.embedding_version
            else "  Neighbours: none (no embeddings ready)\n\n"
        )
    )
    out.write(
        f"  {'Target':<44} {'train':>6} {'test':>5} {'thresh':>6}"
        f" {'prec':>6} {'recall':>6} {'prec@.5':>7} {'rec@.5':>6}\n"
    )
    targets = registry.targets(run.id)
    shown = [
        t for t in targets if everything or t.test_positives or t.predicted_default
    ]
    for t in shown:
        name = t.target if t.kind == "topic" else f"{t.target} → {t.label}"
        threshold = "never" if t.threshold is None else f"{t.threshold:.3f}"
        out.write(
            f"  {name[:44]:<44} {t.train_positives:>6} {t.test_positives:>5}"
            f" {threshold:>6} {_pct(t.precision)} {_pct(t.recall)}"
            f" {_pct(t.precision_default):>7} {_pct(t.recall_default)}\n"
        )
    if len(shown) < len(targets):
        out.write(
            f"\n  {len(targets) - len(shown)} labels had no test mail and"
            " suggested none; --all shows them.\n"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="minerva-mail-ml-train")
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run", help="Train every account, or one")
    run.add_argument("--account", help="Only this mail account ID")
    run.add_argument("--jobs", type=int, default=-1, help="Threads (default: all)")
    suggest = commands.add_parser(
        "suggest", help="Suggestions over the whole mailbox, posted to the API"
    )
    suggest.add_argument("--account", help="Only this mail account ID")
    suggest.add_argument("--jobs", type=int, default=-1, help="Threads (default: all)")
    rescore = commands.add_parser(
        "score-inbox",
        help="Score what is to review in the inbox again with the serving model",
    )
    rescore.add_argument("--account", help="Only this mail account ID")
    learn = commands.add_parser(
        "learn",
        help="Learn from approvals in the inbox once, as the service does",
    )
    learn.add_argument("--account", help="Only this mail account ID")
    payments = commands.add_parser(
        "payments",
        help="Learn payment confirmations and score the mailbox for them",
    )
    payments.add_argument("--account", help="Only this mail account ID")
    clusters = commands.add_parser(
        "cluster",
        help="Clusters of the mail by its embeddings, and the map, posted to the API",
    )
    clusters.add_argument("--account", help="Only this mail account ID")
    shown = commands.add_parser("report", help="A run's evaluation")
    shown.add_argument("--run", help="This run (default: each account's newest)")
    shown.add_argument(
        "--all", action="store_true", help="Every label, with test mail or not"
    )
    args = parser.parse_args(argv)

    try:
        config = read_config()
    except ConfigError as error:
        logging.basicConfig(level=logging.ERROR)
        logger.error("%s", error)
        return 1
    logging.basicConfig(
        level=config.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    registry = ModelRegistry(config.model_dir)
    try:
        if args.command == "report":
            if args.run:
                found = registry.run(args.run)
                if found is None:
                    logger.error("No run %s", args.run)
                    return 1
                runs = [found]
            else:
                newest: dict[str, Run] = {}
                for r in registry.runs(limit=1000):
                    newest.setdefault(r.account_id, r)
                runs = list(newest.values())
                if not runs:
                    sys.stdout.write("No training runs yet.\n")
            for r in runs:
                report(registry, r, everything=args.all)
            return 0

        if config.api is None:
            logger.error(
                "Training and suggesting need the API: API_BASE_URL, API_CLIENT_CERT,"
                " API_CLIENT_KEY and API_CA_CERT"
            )
            return 1
        store = FeatureStore(config.store_path)
        api = OlympusApi(config.api)
        failed = 0
        try:
            accounts = (
                [args.account] if args.account else [a.id for a in api.accounts()]
            )
            models = ServingModels(registry, store)
            for account in accounts:
                try:
                    if args.command == "suggest":
                        suggest_account(store, registry, api, account, jobs=args.jobs)
                    elif args.command == "score-inbox":
                        scored = score_inbox(store, models, api, account)
                        logger.info(
                            "Account %s: scored %d in the inbox", account, scored
                        )
                    elif args.command == "payments":
                        score_payments(store, api, account)
                    elif args.command == "cluster":
                        cluster_account(store, api, account)
                    elif args.command == "learn":
                        learned = learn_account(store, registry, models, api, account)
                        logger.info(
                            "Account %s: learned %d approvals (%d waiting, %d"
                            " without features), scored %d in the inbox",
                            account,
                            learned.learned,
                            learned.waiting,
                            learned.without_features,
                            learned.rescored,
                        )
                    else:
                        train_account(store, registry, api, account, jobs=args.jobs)
                except (TrainingError, SuggestError, ClusterError) as error:
                    # Not enough mail yet is not an outage; the run says why.
                    logger.warning("Account %s: nothing done: %s", account, error)
                except Exception:
                    logger.exception("Account %s failed", account)
                    failed += 1
        finally:
            api.close()
            store.close()
        return 1 if failed else 0
    finally:
        registry.close()


if __name__ == "__main__":
    sys.exit(main())
