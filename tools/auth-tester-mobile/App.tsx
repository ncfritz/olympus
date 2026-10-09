import { AuthFlowError, decodeToken } from "@ncfritz/olympus-auth-flow";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type ApiPath,
  baseUrlOf,
  DEFAULT_TARGET,
  describe,
  DIRECT_PATH,
  isResolved,
  NAMED,
  type NamedTarget,
  resolve,
} from "./src/endpoints";
import { type Called, createCaller, type Listed } from "./src/api";
import { CallLog } from "./src/CallLog";
import { logged, type Logged } from "./src/called";
import { CertificateCalls } from "./src/CertificateCalls";
import { PROVIDER, REDIRECT_URI, signIn } from "./src/signIn";
import { styles } from "./src/styles";
import {
  clearTokens,
  loadSettings,
  loadTokens,
  saveSettings,
  saveTokens,
  type Settings,
  type StoredTokens,
} from "./src/storage";

const PROMPT = "Unlock the Olympus tokens stored on this device";

const DEFAULTS: Settings = {
  target: DEFAULT_TARGET,
  ephemeral: false,
  // On by default: a refresh token lives for weeks on a device that leaves the
  // house. Off is for a simulator, which never prompts.
  requireAuthentication: true,
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState<"http" | "https">("http");
  const [apiPath, setApiPath] = useState<ApiPath>(DIRECT_PATH);
  // undefined until it has been looked for: "no tokens" and "not looked yet"
  // are different things to say.
  const [tokens, setTokens] = useState<StoredTokens | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  /** What the last attempt did, in a line. */
  const [outcome, setOutcome] = useState<string | undefined>(undefined);
  const [log, setLog] = useState<Logged[]>([]);
  const [path, setCallPath] = useState("/olympus/ping");
  const [sessions, setSessions] = useState<Listed[] | undefined>(undefined);

  // What was chosen last time, so the tester comes back where it was.
  useEffect(() => {
    void (async () => {
      const stored = await loadSettings();
      if (stored !== undefined) {
        setSettings(stored);
        if (stored.target.kind === "custom") {
          setHost(stored.target.host);
          setPort(stored.target.port ?? "");
          setProtocol(stored.target.protocol);
          setApiPath(stored.target.path ?? DIRECT_PATH);
        }
      }
      setLoaded(true);
    })();
  }, []);

  const change = (next: Settings) => {
    setSettings(next);
    if (loaded) void saveSettings(next);
  };

  const resolved = resolve(settings.target);
  // A string rather than a property of `resolved`: see `baseUrlOf`.
  const baseUrl = baseUrlOf(settings.target);

  // One set of clients per API, holding its tokens in memory so that a call
  // does not prompt for Face ID. Rebuilt when the target changes, which is also
  // when the tokens do.
  const caller = useMemo(
    () =>
      baseUrl === undefined
        ? undefined
        : createCaller({
            apiBaseUrl: baseUrl,
            persist: (rotated) =>
              saveTokens(baseUrl, rotated, {
                requireAuthentication: settings.requireAuthentication,
              }),
            // A rotation happens inside a call; this is how the screen hears.
            onChange: (rotated) =>
              setTokens(
                rotated === undefined
                  ? { state: "none" }
                  : { state: "signed-in", tokens: rotated },
              ),
          }),
    [baseUrl, settings.requireAuthentication],
  );

  // Whether this target has tokens, asked again whenever the target changes:
  // each one keeps its own, so switching does not sign anything out. No
  // `setTokens` in the body of this effect -- a synchronous setState in an
  // effect is a cascading render, and there is nothing to say synchronously:
  // with no target resolved there is nothing to look for, and the screen says
  // that from `baseUrl` itself.
  useEffect(() => {
    if (baseUrl === undefined) return;
    let current = true;
    void (async () => {
      const found = await loadTokens(baseUrl, {
        requireAuthentication: settings.requireAuthentication,
        prompt: PROMPT,
      });
      // The target can change while Face ID is on screen; the answer to the
      // question nobody is asking any more is dropped.
      if (!current) return;
      setTokens(found);
      caller?.session.hold(
        found.state === "signed-in" ? found.tokens : undefined,
      );
    })();
    return () => {
      current = false;
    };
  }, [baseUrl, settings.requireAuthentication, caller]);

  const start = async (baseUrlNow: string) => {
    setBusy(true);
    setOutcome(undefined);
    try {
      const result = await signIn({
        apiBaseUrl: baseUrlNow,
        ephemeral: settings.ephemeral,
        // What the session list will call this device. expo-device would give
        // its name; `Platform` is already here and says enough.
        deviceName: `auth tester on ${Platform.OS} ${String(Platform.Version)}`,
      });
      if (result.outcome === "cancelled") {
        setOutcome("Cancelled.");
        return;
      }
      if (result.outcome === "refused") {
        setOutcome(result.reason);
        return;
      }
      await saveTokens(baseUrlNow, result.tokens, {
        requireAuthentication: settings.requireAuthentication,
      });
      setTokens({ state: "signed-in", tokens: result.tokens });
      caller?.session.hold(result.tokens);
      setOutcome(`Signed in with ${PROVIDER}.`);
    } catch (error: unknown) {
      // An AuthFlowError is the API refusing a grant, which is an answer and
      // reads as a sentence. Anything else is this app being wrong.
      setOutcome(
        error instanceof AuthFlowError
          ? error.message
          : `Unexpected: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const forget = async (baseUrlNow: string) => {
    await clearTokens(baseUrlNow);
    setTokens({ state: "none" });
    caller?.session.hold(undefined);
    setOutcome("Forgotten on this device. The session itself is still open.");
  };

  const record = (called: Called) => {
    setLog((entries) => [logged(called), ...entries].slice(0, 20));
  };

  const run = async (call: () => Promise<Called>) => {
    record(await call());
  };

  /** Everything the API knows about these tokens is gone; forget them here too. */
  const dropTokens = async (baseUrlNow: string) => {
    await clearTokens(baseUrlNow);
    setTokens({ state: "none" });
    setSessions(undefined);
  };

  const list = async () => {
    if (caller === undefined) return;
    const { called, listed } = await caller.sessions();
    record(called);
    setSessions(called.status === 200 ? listed : undefined);
  };

  const replay = async (baseUrlNow: string) => {
    if (caller === undefined) return;
    const { called, verdict } = await caller.replay();
    record(called);
    // Refused and revoked leaves both tokens dead; an accepted replay leaves
    // what is held here untrustworthy. Either way, start again.
    if (verdict !== "refused-only") await dropTokens(baseUrlNow);
  };

  const revoke = async (baseUrlNow: string, sessionId: string) => {
    if (caller === undefined) return;
    const { called, itsOwn } = await caller.revoke(sessionId);
    record(called);
    if (itsOwn) {
      await dropTokens(baseUrlNow);
      record({
        method: "note",
        path: "",
        took: 0,
        answer:
          "that was this device's session: the refresh token is dead, though the access token would be accepted for its remaining minutes (ADR 0018)",
      });
    } else {
      await list();
    }
  };

  const out = async (baseUrlNow: string) => {
    if (caller === undefined) return;
    record(await caller.signOut());
    await dropTokens(baseUrlNow);
  };

  const claims = () => {
    if (tokens?.state !== "signed-in") return undefined;
    try {
      const decoded = decodeToken(tokens.tokens.accessToken);
      const order = [
        "sub",
        "sid",
        "client_id",
        "roles",
        "aud",
        "iat",
        "auth_time",
        "exp",
      ];
      return [
        ["kid", String(decoded.header.kid)] as const,
        ...order
          .filter((name) => name in decoded.claims)
          .map(
            (name) =>
              [name, String(decoded.claims[name])] as readonly [string, string],
          ),
      ];
    } catch {
      // Stored by an older build, or truncated. Not worth a dialogue.
      return undefined;
    }
  };

  const named = (name: NamedTarget) => {
    const chosen =
      settings.target.kind === "named" && settings.target.name === name;
    return (
      <Pressable
        key={name}
        onPress={() => change({ ...settings, target: { kind: "named", name } })}
        style={[styles.row, chosen && styles.chosen]}
      >
        <Text style={styles.rowTitle}>
          {chosen ? "● " : "○ "}
          {NAMED[name].label}
        </Text>
        <Text style={styles.rowDetail}>https://{NAMED[name].host}</Text>
        <Text style={styles.note}>{NAMED[name].note}</Text>
      </Pressable>
    );
  };

  const customChosen = settings.target.kind === "custom";
  const custom = (
    next: Partial<{
      protocol: "http" | "https";
      host: string;
      port: string;
      path: ApiPath;
    }>,
  ) => {
    const values = { protocol, host, port, path: apiPath, ...next };
    setProtocol(values.protocol);
    setHost(values.host);
    setPort(values.port);
    setApiPath(values.path);
    change({
      ...settings,
      target: {
        kind: "custom",
        protocol: values.protocol,
        host: values.host,
        path: values.path,
        ...(values.port === "" ? {} : { port: values.port }),
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Olympus auth tester</Text>
        <Text style={styles.subtitle}>
          {baseUrl ?? (resolved as { problem: string }).problem}
        </Text>
        {isResolved(resolved) && resolved.warning !== undefined && (
          <Text style={styles.warning}>{resolved.warning}</Text>
        )}

        <Text style={styles.heading}>API</Text>
        {(["production", "internal", "dev"] as NamedTarget[]).map(named)}

        <Pressable
          onPress={() => custom({})}
          style={[styles.row, customChosen && styles.chosen]}
        >
          <Text style={styles.rowTitle}>
            {customChosen ? "● " : "○ "}A host of my own
          </Text>
          <Text style={styles.note}>
            A laptop on the LAN. `localhost` is this phone, so use its address.
          </Text>

          <View style={styles.protocols}>
            {(["http", "https"] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => custom({ protocol: option })}
                style={[
                  styles.protocol,
                  protocol === option && styles.protocolChosen,
                ]}
              >
                <Text
                  style={[
                    styles.protocolText,
                    protocol === option && styles.protocolTextChosen,
                  ]}
                >
                  {option}://
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.protocols}>
            {(["/v1", "/api/v1"] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => custom({ path: option })}
                style={[
                  styles.protocol,
                  apiPath === option && styles.protocolChosen,
                ]}
              >
                <Text
                  style={[
                    styles.protocolText,
                    apiPath === option && styles.protocolTextChosen,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>
            An API from the workspace serves /v1 itself; the /api in front of
            the hosts above is nginx&apos;s.
          </Text>

          <View style={styles.inputs}>
            <TextInput
              value={host}
              onChangeText={(value) => custom({ host: value })}
              placeholder="192.168.1.10"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, styles.hostInput]}
            />
            <TextInput
              value={port}
              onChangeText={(value) => custom({ port: value })}
              placeholder="3001"
              keyboardType="number-pad"
              style={[styles.input, styles.portInput]}
            />
          </View>
        </Pressable>

        <Text style={styles.heading}>Sign-in</Text>
        <View style={styles.setting}>
          <View style={styles.settingText}>
            <Text style={styles.rowTitle}>Ephemeral session</Text>
            <Text style={styles.note}>
              No cookies shared with Safari, so a different user can sign in.
            </Text>
          </View>
          <Switch
            value={settings.ephemeral}
            onValueChange={(value) => change({ ...settings, ephemeral: value })}
          />
        </View>
        <View style={styles.setting}>
          <View style={styles.settingText}>
            <Text style={styles.rowTitle}>Face ID for stored tokens</Text>
            <Text style={styles.note}>
              A simulator never prompts, so turn this off there.
            </Text>
          </View>
          <Switch
            value={settings.requireAuthentication}
            onValueChange={(value) =>
              change({ ...settings, requireAuthentication: value })
            }
          />
        </View>

        <Pressable
          onPress={() => {
            if (baseUrl !== undefined && !busy) void start(baseUrl);
          }}
          disabled={baseUrl === undefined || busy}
          style={[
            styles.button,
            (baseUrl === undefined || busy) && styles.buttonOff,
          ]}
        >
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.buttonText}>
              {tokens?.state === "signed-in" ? "Sign in again" : "Sign in"}
            </Text>
          )}
        </Pressable>
        {outcome !== undefined && <Text style={styles.note}>{outcome}</Text>}

        <Text style={styles.heading}>Calls</Text>
        <Text style={styles.note}>
          Through @ncfritz/olympus-client, with the access token attached and
          refreshed when it has expired.
        </Text>
        <View style={styles.inputs}>
          <Pressable
            onPress={() => {
              if (caller) void run(() => caller.whoami());
            }}
            disabled={caller === undefined}
            style={[styles.small, caller === undefined && styles.buttonOff]}
          >
            <Text style={styles.smallText}>Who am I</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void list();
            }}
            disabled={caller === undefined}
            style={[styles.small, caller === undefined && styles.buttonOff]}
          >
            <Text style={styles.smallText}>Sessions</Text>
          </Pressable>
        </View>
        <View style={styles.inputs}>
          <TextInput
            value={path}
            onChangeText={setCallPath}
            placeholder="/olympus/ping"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, styles.hostInput]}
          />
          <Pressable
            onPress={() => {
              if (caller) void run(() => caller.get(path));
            }}
            disabled={caller === undefined}
            style={[styles.small, caller === undefined && styles.buttonOff]}
          >
            <Text style={styles.smallText}>GET</Text>
          </Pressable>
        </View>
        <CallLog
          entries={log}
          onClear={(id) =>
            setLog((entries) => entries.filter((entry) => entry.id !== id))
          }
        />

        {sessions !== undefined && (
          <View style={styles.claims}>
            {sessions.map((session) => (
              <View key={session.id} style={styles.called}>
                <Text style={styles.calledHead}>
                  {session.current ? "● " : "○ "}
                  {session.clientId}
                  {session.deviceName === undefined
                    ? ""
                    : ` · ${session.deviceName}`}
                </Text>
                <Text style={styles.calledBody}>
                  {session.id} · expires {session.expiresTime}
                </Text>
                <Pressable
                  onPress={() => {
                    if (baseUrl !== undefined) void revoke(baseUrl, session.id);
                  }}
                  style={[styles.small, styles.buttonQuiet, styles.revoke]}
                >
                  <Text style={styles.buttonQuietText}>
                    Revoke{session.current ? " (this one)" : ""}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.heading}>Tokens</Text>
        <Text style={styles.note}>
          Refresh rotates now; the replay presents the token the last rotation
          replaced, and then the live one — both refused is reuse detection, and
          the session is gone with them (ADR 0018).
        </Text>
        <View style={styles.inputs}>
          <Pressable
            onPress={() => {
              if (caller) void run(() => caller.refresh());
            }}
            disabled={caller === undefined}
            style={[styles.small, caller === undefined && styles.buttonOff]}
          >
            <Text style={styles.smallText}>Refresh</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (baseUrl !== undefined) void replay(baseUrl);
            }}
            disabled={caller === undefined}
            style={[styles.small, caller === undefined && styles.buttonOff]}
          >
            <Text style={styles.smallText}>Replay previous</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (baseUrl !== undefined) void out(baseUrl);
            }}
            disabled={caller === undefined}
            style={[styles.small, styles.buttonQuiet]}
          >
            <Text style={styles.buttonQuietText}>Sign out</Text>
          </Pressable>
        </View>

        {loaded && (
          <CertificateCalls
            target={settings.target}
            baseUrl={settings.servicesBaseUrl ?? ""}
            clientName={settings.serviceClientName ?? ""}
            onChange={(next) =>
              change({
                ...settings,
                servicesBaseUrl: next.baseUrl,
                serviceClientName: next.clientName,
              })
            }
          />
        )}

        <Text style={styles.heading}>This device</Text>
        <Text style={styles.note}>
          {baseUrl === undefined
            ? "Nothing to look for until the API above resolves."
            : tokens === undefined
              ? "Looking…"
              : tokens.state === "signed-in"
                ? `Signed in to ${describe(settings.target)} as ${tokens.tokens.provider}, saved ${tokens.tokens.savedAt}.`
                : tokens.state === "locked"
                  ? "Tokens are stored for this API but were not unlocked."
                  : "No tokens for this API yet."}
        </Text>
        {claims() !== undefined && (
          <View style={styles.claims}>
            {claims()!.map(([name, value]) => (
              <View key={name} style={styles.claim}>
                <Text style={styles.claimName}>{name}</Text>
                <Text style={styles.claimValue} numberOfLines={2}>
                  {value}
                </Text>
              </View>
            ))}
            <Text style={styles.note}>
              Decoded, not verified: whether the signature is good is the
              API&apos;s answer to give, and it gives it by accepting the token.
            </Text>
          </View>
        )}
        {tokens?.state !== "none" && baseUrl !== undefined && (
          <Pressable
            onPress={() => {
              void forget(baseUrl);
            }}
            style={[styles.button, styles.buttonQuiet]}
          >
            <Text style={styles.buttonQuietText}>
              Forget tokens on this device
            </Text>
          </Pressable>
        )}
        <Text style={styles.note}>Redirect: {REDIRECT_URI}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
