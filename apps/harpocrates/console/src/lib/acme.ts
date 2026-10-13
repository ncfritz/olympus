import type {
  AcmeClient,
  AcmeClientCertificate,
  AcmeCredential,
  AcmeOrderSummary,
} from "./api/types";

/**
 * The ACME page's reading of its clients and orders: each client's state
 * and next renewal, each order's progress, the graphs' series, and what
 * needs a look.
 */

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
export const DAY = 24 * HOUR;

/** How many days the page's orders cover. */
export const ORDER_DAYS = 30;

/** How many days a client's row shows outcomes for. */
export const OUTCOME_DAYS = 15;

/** The names a credential allows, a subtree marked as such. */
export const namesOf = (credential: AcmeCredential): string[] => [
  ...(credential.names.exact ?? []),
  ...(credential.names.subtrees ?? []).map((name) => `${name} and below`),
];

/** A client's state: waiting to bind, bound, or not usable any more. */
export type ClientState = "waiting" | "bound" | "revoked" | "deactivated";

export const stateOf = (client: AcmeClient): ClientState => {
  const { credential } = client;
  if (credential.revokedAt) return "revoked";
  if (!credential.account) return "waiting";
  return credential.account.status === "valid" ? "bound" : "deactivated";
};

export const STATES: Record<ClientState, { label: string; color: string }> = {
  bound: { label: "Bound", color: "green" },
  waiting: { label: "Waiting to bind", color: "gold" },
  revoked: { label: "Revoked", color: "default" },
  deactivated: { label: "Deactivated", color: "default" },
};

/** An order's outcome, as its row and the graphs mark it. */
export type Outcome = "issued" | "failed" | "pending";

export const outcomeOf = (order: AcmeOrderSummary): Outcome =>
  order.status === "valid"
    ? "issued"
    : order.status === "invalid"
      ? "failed"
      : "pending";

export const OUTCOMES: Record<Outcome, { label: string; color: string }> = {
  issued: { label: "Issued", color: "green" },
  failed: { label: "Failed", color: "red" },
  pending: { label: "In progress", color: "blue" },
};

/** The steps of an order, as the funnel and an order's progress show them. */
export const STEPS = [
  "Order",
  "Authorization",
  "Challenge",
  "Finalize",
  "Certificate",
] as const;

/** How far an order got: the steps done, and the one it failed at. */
export const progressOf = (
  order: AcmeOrderSummary,
): { done: number; failedAt?: number } => {
  if (order.status === "valid") return { done: STEPS.length };
  const proved = order.authorizations.every((a) => a.status === "valid");
  const challengeFailed = order.authorizations.some((a) =>
    a.challenges.some((c) => c.status === "invalid"),
  );
  if (order.status === "invalid") {
    if (challengeFailed) return { done: 2, failedAt: 2 };
    if (!proved) return { done: 1, failedAt: 1 };
    return { done: 3, failedAt: 3 };
  }
  if (order.status === "processing") return { done: 4 };
  if (order.status === "ready") return { done: 3 };
  const answered = order.authorizations.some((a) => a.challenges.length > 0);
  return { done: answered ? 2 : 1 };
};

/** The challenge types an order's names were proved by (or tried). */
export const challengeTypesOf = (order: AcmeOrderSummary): string[] => [
  ...new Set(
    order.authorizations.flatMap((a) => a.challenges.map((c) => c.type)),
  ),
];

/** Why an order failed: its first failed challenge's reason, or its own. */
export const failureOf = (
  order: AcmeOrderSummary,
): { type: string; detail?: string } | undefined => {
  if (order.status !== "invalid") return undefined;
  const challenge = order.authorizations
    .flatMap((a) => a.challenges)
    .find((c) => c.status === "invalid");
  const type = challenge?.errorType ?? order.errorType ?? "unknown";
  return { type, detail: challenge?.errorDetail ?? order.errorDetail };
};

/** An ACME error type, as a person would say why it failed. */
export const REASONS: Record<string, string> = {
  connection: "Could not connect",
  incorrectResponse: "Wrong answer served",
  dns: "Name not found in DNS",
  tls: "TLS handshake failed",
  unauthorized: "Not proved",
  malformed: "Expired or malformed",
  rejectedIdentifier: "Name refused",
  badCSR: "CSR refused",
  serverInternal: "Harpocrates failed",
  unknown: "No reason given",
};

export const reasonOf = (type: string): string => REASONS[type] ?? type;

/** How long an order took to its certificate, in milliseconds. */
export const timeTakenOf = (order: AcmeOrderSummary): number | undefined =>
  order.issuedAt
    ? Math.max(0, Date.parse(order.issuedAt) - Date.parse(order.createdAt))
    : undefined;

/** "0.9 s", "12 s", "3 min": how long an order took. */
export const formatTaken = (ms: number): string =>
  ms < 10 * SECOND
    ? `${(ms / SECOND).toFixed(1)} s`
    : ms < 60 * SECOND
      ? `${Math.round(ms / SECOND)} s`
      : `${Math.round(ms / (60 * SECOND))} min`;

/** A client's orders among those read, newest first. */
export const ordersOf = (
  orders: AcmeOrderSummary[],
  credentialId: string,
): AcmeOrderSummary[] => orders.filter((o) => o.credentialId === credentialId);

/** Midnight (local) of the day a time falls in. */
const dayOf = (time: number): number => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** Each of the last `days`, oldest first: its date and its orders' outcomes. */
export const perDay = (
  orders: AcmeOrderSummary[],
  days: number,
  now: number,
): { day: number; issued: number; failed: number; pending: number }[] => {
  const today = dayOf(now);
  const rows = Array.from({ length: days }, (_, i) => ({
    day: today - (days - 1 - i) * DAY,
    issued: 0,
    failed: 0,
    pending: 0,
  }));
  const index = new Map(rows.map((row, i) => [row.day, i]));
  for (const order of orders) {
    const i = index.get(dayOf(Date.parse(order.createdAt)));
    if (i !== undefined) rows[i][outcomeOf(order)] += 1;
  }
  return rows;
};

/**
 * A client's last `days`, oldest first: each day's outcome, the day's last
 * order's (undefined for a day without one).
 */
export const outcomesByDay = (
  orders: AcmeOrderSummary[],
  days: number,
  now: number,
): (Outcome | undefined)[] => {
  const today = dayOf(now);
  const outcomes: (Outcome | undefined)[] = Array(days).fill(undefined);
  // Newest first: the first seen for a day is its last.
  for (const order of orders) {
    const i =
      days - 1 - Math.round((today - dayOf(Date.parse(order.createdAt))) / DAY);
    if (i >= 0 && i < days && outcomes[i] === undefined) {
      outcomes[i] = outcomeOf(order);
    }
  }
  return outcomes;
};

/**
 * From order to certificate: the orders placed, the names in them, the
 * names proved, the orders finalized, and the certificates issued.
 */
export const funnelOf = (
  orders: AcmeOrderSummary[],
): { step: string; count: number }[] => {
  const authorizations = orders.flatMap((o) => o.authorizations);
  return [
    { step: "Orders", count: orders.length },
    { step: "Names to prove", count: authorizations.length },
    {
      step: "Names proved",
      count: authorizations.filter((a) => a.status === "valid").length,
    },
    {
      step: "Finalized",
      count: orders.filter(
        (o) => o.status === "processing" || o.status === "valid",
      ).length,
    },
    {
      step: "Certificates",
      count: orders.filter((o) => o.certificateId).length,
    },
  ];
};

/** Why orders failed, most often first. */
export const failureReasons = (
  orders: AcmeOrderSummary[],
): { reason: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const failure = failureOf(order);
    if (failure) {
      const reason = reasonOf(failure.type);
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
};

/** The buckets of time taken, order to certificate. */
export const TAKEN_BUCKETS = [
  { label: "< 2 s", below: 2 * SECOND },
  { label: "2–5 s", below: 5 * SECOND },
  { label: "5–30 s", below: 30 * SECOND },
  { label: "30 s – 5 min", below: 5 * 60 * SECOND },
  { label: "> 5 min", below: Infinity },
] as const;

/** The issued orders by how long they took. */
export const timeTaken = (orders: AcmeOrderSummary[]): number[] => {
  const counts = TAKEN_BUCKETS.map(() => 0);
  for (const order of orders) {
    const taken = timeTakenOf(order);
    if (taken !== undefined) {
      counts[TAKEN_BUCKETS.findIndex((b) => taken < b.below)] += 1;
    }
  }
  return counts;
};

/** Where a certificate stands against its renewal window. */
export type WindowState = "ahead" | "renewing" | "overdue";

export const windowStateOf = (
  certificate: AcmeClientCertificate,
  now: number,
): WindowState =>
  now >= Date.parse(certificate.renewalEnd)
    ? "overdue"
    : now >= Date.parse(certificate.renewalStart)
      ? "renewing"
      : "ahead";

/** A client's next renewal: the certificate whose window comes first. */
export const nextRenewalOf = (
  client: AcmeClient,
): AcmeClientCertificate | undefined => client.certificates[0];

/** Whether a client is failing: its last order failed, or a renewal is overdue. */
export const isFailing = (client: AcmeClient, now: number): boolean =>
  stateOf(client) === "bound" &&
  (client.lastOrder?.status === "invalid" ||
    client.certificates.some((c) => windowStateOf(c, now) === "overdue"));

/** Something about a client that needs a look, worst first. */
export type LookItem = {
  key: string;
  credentialId: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  hint: string;
};

/**
 * What needs a look: clients failing (their last order failed, or a
 * renewal past its window), credentials never bound, and clients inside
 * a renewal window now, which their clients should renew on their next
 * run.
 */
export const needsALook = (
  clients: AcmeClient[],
  orders: AcmeOrderSummary[],
  now: number,
): LookItem[] => {
  const items: LookItem[] = [];
  for (const client of clients) {
    const { credential } = client;
    const state = stateOf(client);
    if (state === "waiting") {
      items.push({
        key: `waiting-${credential.id}`,
        credentialId: credential.id,
        severity: "warning",
        title: `${credential.label}: never bound`,
        detail: `Its credential was made ${ago(credential.createdAt, now)} and no client has registered with it.`,
        hint: "If its HMAC key was lost: revoke it and make another.",
      });
      continue;
    }
    if (state !== "bound") continue;
    const failures = ordersOf(orders, credential.id).filter(
      (o) => o.status === "invalid",
    );
    const overdue = client.certificates.find(
      (c) => windowStateOf(c, now) === "overdue",
    );
    if (client.lastOrder?.status === "invalid" || overdue) {
      const failure = client.lastOrder && failureOf(client.lastOrder);
      const expiry = overdue ?? nextRenewalOf(client);
      items.push({
        key: `failing-${credential.id}`,
        credentialId: credential.id,
        severity: "error",
        title: `${credential.label}: renewal failing`,
        detail: [
          failure
            ? `Its last order failed: ${reasonOf(failure.type).toLowerCase()}${failure.detail ? ` (${failure.detail})` : ""}.`
            : `Past its renewal window since ${ago(overdue!.renewalEnd, now)}, and not renewed.`,
          failures.length > 1
            ? `${failures.length} failed orders in ${ORDER_DAYS} days.`
            : "",
          expiry
            ? `Its certificate expires ${until(expiry.notAfter, now)}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        hint: hintFor(failure?.type),
      });
      continue;
    }
    const renewing = client.certificates.find(
      (c) => windowStateOf(c, now) === "renewing",
    );
    if (renewing) {
      items.push({
        key: `renewing-${credential.id}`,
        credentialId: credential.id,
        severity: "info",
        title: `${credential.label}: renewing`,
        detail: `Inside its renewal window since ${ago(renewing.renewalStart, now)}; its client renews on its next run.`,
        hint: `Nothing to do unless it is still here when the window closes, ${until(renewing.renewalEnd, now)}.`,
      });
    }
  }
  const rank = { error: 0, warning: 1, info: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
};

/** What to check, for a reason a challenge failed. */
const hintFor = (type: string | undefined): string => {
  switch (type) {
    case "connection":
      return "Check that port 80 (http-01) or 443 (tls-alpn-01) on the host is reachable from Harpocrates, and its ACME client's log.";
    case "incorrectResponse":
      return "Something else answered at the challenge path: check the host's web server and its ACME client's log.";
    case "dns":
      return "Check the name resolves, from the PKI host, to the host that runs the client.";
    default:
      return "Check its ACME client's log.";
  }
};

const ago = (iso: string, now: number): string => {
  const days = Math.floor((now - Date.parse(iso)) / DAY);
  return days < 1 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

const until = (iso: string, now: number): string => {
  const days = Math.ceil((Date.parse(iso) - now) / DAY);
  return days <= 0 ? "now" : days === 1 ? "tomorrow" : `in ${days} days`;
};

/** The page's headline counts. */
export const countsOf = (
  clients: AcmeClient[],
  orders: AcmeOrderSummary[],
  now: number,
) => {
  const states = clients.map(stateOf);
  const failing = clients.filter((c) => isFailing(c, now));
  const next = clients
    .filter((c) => stateOf(c) === "bound")
    .flatMap((c) =>
      c.certificates.map((certificate) => ({ client: c, certificate })),
    )
    .filter(({ certificate }) => windowStateOf(certificate, now) !== "overdue")
    .sort(
      (a, b) =>
        Date.parse(a.certificate.renewalStart) -
        Date.parse(b.certificate.renewalStart),
    )[0];
  return {
    clients: clients.filter((_, i) => states[i] !== "revoked").length,
    bound: states.filter((s) => s === "bound").length,
    waiting: states.filter((s) => s === "waiting").length,
    held: clients.reduce((sum, c) => sum + c.certificates.length, 0),
    orders: orders.length,
    issued: orders.filter((o) => o.status === "valid").length,
    failed: orders.filter((o) => o.status === "invalid").length,
    failing,
    next,
  };
};

/** How a client takes its credential: a command or configuration each. */
export const clientSetups = ({
  directoryUrl,
  kid,
  hmacKey,
  name,
}: {
  directoryUrl: string;
  kid: string;
  hmacKey: string;
  name: string;
}): { key: string; label: string; text: string }[] => [
  {
    key: "certbot",
    label: "certbot",
    text: [
      `REQUESTS_CA_BUNDLE=/path/to/root.pem certbot certonly \\`,
      `  --server ${directoryUrl} \\`,
      `  --eab-kid ${kid} --eab-hmac-key ${hmacKey} \\`,
      `  --email you@ncfritz.net --agree-tos --key-type ecdsa \\`,
      `  --standalone -d ${name}`,
    ].join("\n"),
  },
  {
    key: "acme.sh",
    label: "acme.sh",
    text: [
      `acme.sh --server ${directoryUrl} --ca-bundle /path/to/root.pem \\`,
      `  --register-account -m you@ncfritz.net \\`,
      `  --eab-kid ${kid} --eab-hmac-key ${hmacKey}`,
      `acme.sh --server ${directoryUrl} --ca-bundle /path/to/root.pem \\`,
      `  --issue -d ${name} --standalone --keylength ec-256`,
    ].join("\n"),
  },
  {
    key: "lego",
    label: "lego",
    text: [
      `LEGO_CA_CERTIFICATES=/path/to/root.pem lego \\`,
      `  --server ${directoryUrl} \\`,
      `  --eab --kid ${kid} --hmac ${hmacKey} \\`,
      `  --email you@ncfritz.net --accept-tos \\`,
      `  --domains ${name} --http run`,
    ].join("\n"),
  },
  {
    key: "caddy",
    label: "Caddy",
    text: [
      "{",
      `  acme_ca ${directoryUrl}`,
      "  acme_ca_root /path/to/root.pem",
      "  acme_eab {",
      `    key_id ${kid}`,
      `    mac_key ${hmacKey}`,
      "  }",
      "}",
    ].join("\n"),
  },
  {
    key: "traefik",
    label: "Traefik",
    text: [
      "# traefik.yml; and LEGO_CA_CERTIFICATES=/path/to/root.pem in its environment",
      "certificatesResolvers:",
      "  harpocrates:",
      "    acme:",
      `      caServer: ${directoryUrl}`,
      "      email: you@ncfritz.net",
      "      storage: /data/acme.json",
      "      eab:",
      `        kid: ${kid}`,
      `        hmacEncoded: ${hmacKey}`,
      "      httpChallenge:",
      "        entryPoint: web",
    ].join("\n"),
  },
];
