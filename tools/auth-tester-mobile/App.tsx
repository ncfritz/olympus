import { AuthFlowError, decodeToken } from "@ncfritz/olympus-auth-flow";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  DEFAULT_TARGET,
  describe,
  isResolved,
  NAMED,
  type NamedTarget,
  resolve,
} from "./src/endpoints";
import { PROVIDER, REDIRECT_URI, signIn } from "./src/signIn";
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
  // undefined until it has been looked for: "no tokens" and "not looked yet"
  // are different things to say.
  const [tokens, setTokens] = useState<StoredTokens | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  /** What the last attempt did, in a line. */
  const [outcome, setOutcome] = useState<string | undefined>(undefined);

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
  const baseUrl = isResolved(resolved) ? resolved.baseUrl : undefined;

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
      if (current) setTokens(found);
    })();
    return () => {
      current = false;
    };
  }, [baseUrl, settings.requireAuthentication]);

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
    setOutcome("Forgotten on this device. The session itself is still open.");
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
    next: Partial<{ protocol: "http" | "https"; host: string; port: string }>,
  ) => {
    const values = { protocol, host, port, ...next };
    setProtocol(values.protocol);
    setHost(values.host);
    setPort(values.port);
    change({
      ...settings,
      target: {
        kind: "custom",
        protocol: values.protocol,
        host: values.host,
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { fontSize: 13, color: "#444", fontFamily: "Menlo" },
  warning: { fontSize: 13, color: "#8a4b00" },
  heading: { fontSize: 13, fontWeight: "600", marginTop: 16, color: "#666" },
  row: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  chosen: { borderColor: "#0a5", backgroundColor: "#f4fbf7" },
  rowTitle: { fontSize: 16 },
  rowDetail: { fontSize: 13, color: "#444", fontFamily: "Menlo" },
  note: { fontSize: 12, color: "#666" },
  protocols: { flexDirection: "row", gap: 8, marginTop: 8 },
  protocol: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  protocolChosen: { borderColor: "#0a5", backgroundColor: "#e8f7ef" },
  protocolText: { fontSize: 14, color: "#444" },
  protocolTextChosen: { color: "#063", fontWeight: "600" },
  inputs: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  hostInput: { flex: 1 },
  portInput: { width: 84 },
  setting: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingText: { flex: 1, gap: 2 },
  button: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: "#0a5",
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonOff: { backgroundColor: "#b9d9c8" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonQuiet: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonQuietText: { color: "#444", fontSize: 15 },
  claims: { marginTop: 8, gap: 4 },
  claim: { flexDirection: "row", gap: 8 },
  claimName: { width: 80, fontSize: 12, color: "#666", fontFamily: "Menlo" },
  claimValue: { flex: 1, fontSize: 12, fontFamily: "Menlo" },
});
