import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CallLog } from "./CallLog";
import { logged, type Logged } from "./called";
import { checkServicesUrl, servicesUrlFor, type Target } from "./endpoints";
import {
  forgetIdentity,
  type ImportedIdentity,
  importIdentity,
  nativeRequest,
  pickAuthoritiesFile,
  pickIdentityFile,
  trustAuthorities,
} from "./identity";
import { clientNameFor, isClientName } from "./mutualTls";
import { createServiceCaller } from "./services";
import { styles } from "./styles";

/**
 * The service border, on a device (ADR 0018, ADR 0023).
 *
 * This is the half of the tester that the CLI cannot stand in for: whether a
 * phone can present a client certificate at all, and whether the listener
 * accepts the identity it presents. Everything above the transport is the same
 * generated SDK as the token calls above -- only the adapter differs.
 */
export const CertificateCalls = ({
  target,
  baseUrl: stored,
  clientName: storedName,
  onChange,
}: {
  /** The API chosen above, which is usually the same machine. */
  target: Target;
  /** As typed and persisted; empty means "whatever the target suggests". */
  baseUrl: string;
  clientName: string;
  onChange: (next: { baseUrl: string; clientName: string }) => void;
}) => {
  const [typedUrl, setTypedUrl] = useState(stored);
  const [typedName, setTypedName] = useState(storedName);
  const [file, setFile] = useState<
    { base64: string; name: string } | undefined
  >(undefined);
  const [password, setPassword] = useState("olympus");
  const [identity, setIdentity] = useState<ImportedIdentity | undefined>(
    undefined,
  );
  const [authorities, setAuthorities] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [path, setPath] = useState("/olympus/ping");
  const [log, setLog] = useState<Logged[]>([]);
  const [busy, setBusy] = useState(false);

  // Nothing is copied from the target into state: the suggestion is what the
  // field falls back to while it is empty, so choosing another API changes the
  // suggestion without overwriting something typed.
  const suggested = servicesUrlFor(target);
  const baseUrl = typedUrl.trim() === "" ? suggested : typedUrl.trim();
  const suggestedName =
    identity === undefined ? undefined : clientNameFor(identity.subject);
  const clientName = typedName.trim() === "" ? suggestedName : typedName.trim();
  const usable = clientName !== undefined && isClientName(clientName);
  const checked = checkServicesUrl(baseUrl ?? "");
  const reachable = checked.problem === undefined;

  const caller = useMemo(
    () =>
      baseUrl === undefined || clientName === undefined || !usable || !reachable
        ? undefined
        : createServiceCaller({
            baseUrl,
            clientName,
            request: nativeRequest,
          }),
    [baseUrl, clientName, usable, reachable],
  );

  const keep = (next: { baseUrl?: string; clientName?: string }) => {
    const values = {
      baseUrl: next.baseUrl ?? typedUrl,
      clientName: next.clientName ?? typedName,
    };
    setTypedUrl(values.baseUrl);
    setTypedName(values.clientName);
    onChange(values);
  };

  /** Anything native, with its failure shown rather than thrown at the screen. */
  const attempt = async (what: () => Promise<string | undefined>) => {
    setBusy(true);
    try {
      const said = await what();
      if (said !== undefined) setNote(said);
    } catch (error: unknown) {
      setNote(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const choose = () =>
    attempt(async () => {
      const chosen = await pickIdentityFile();
      if (chosen === undefined) return undefined;
      setFile(chosen);
      setIdentity(undefined);
      return `${chosen.name} chosen. Import it to present it.`;
    });

  const unlock = () =>
    attempt(async () => {
      if (file === undefined) return "choose a PKCS#12 first";
      const imported = await importIdentity(file.base64, password);
      setIdentity(imported);
      return `Presenting ${imported.subject}, with ${imported.chainLength} certificate${imported.chainLength === 1 ? "" : "s"} in the chain.`;
    });

  const trust = () =>
    attempt(async () => {
      const chosen = await pickAuthoritiesFile();
      if (chosen === undefined) return undefined;
      const count = await trustAuthorities(chosen.pem);
      setAuthorities(chosen.name);
      return `Validating the server against ${count} certificate${count === 1 ? "" : "s"} from ${chosen.name}, and nothing else.`;
    });

  const forget = () => {
    forgetIdentity();
    setFile(undefined);
    setIdentity(undefined);
    setAuthorities(undefined);
    setNote("Forgotten. Nothing was written to the Keychain to begin with.");
  };

  const call = () =>
    attempt(async () => {
      if (caller === undefined) return undefined;
      const called = await caller.get(path);
      setLog((entries) => [logged(called), ...entries].slice(0, 20));
      return undefined;
    });

  return (
    <View>
      <Text style={styles.heading}>Certificate calls</Text>
      <Text style={styles.note}>
        The services listener authenticates the caller by the certificate it
        presents: no token, no user (ADR 0018). React Native cannot present one,
        so these calls go through the client-identity native module — the SDK
        above it is the same.
      </Text>

      <View style={styles.inputs}>
        <TextInput
          value={typedUrl}
          onChangeText={(value) => keep({ baseUrl: value })}
          placeholder={suggested ?? "https://192.168.1.10:3443/v1"}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, styles.hostInput]}
        />
      </View>
      <Text style={styles.rowDetail}>{baseUrl ?? "nothing to call yet"}</Text>
      {checked.problem !== undefined && (
        <Text style={styles.warning}>{checked.problem}</Text>
      )}
      {checked.warning !== undefined && (
        <Text style={styles.warning}>{checked.warning}</Text>
      )}
      <Text style={styles.note}>
        The listener is reached directly: a certificate presented at one of the
        named front doors reaches nginx and stops there. The line above is the
        URL this will actually call — an empty field uses the suggestion.
      </Text>

      <View style={styles.inputs}>
        <Pressable
          onPress={() => {
            if (!busy) void choose();
          }}
          style={[styles.small, busy && styles.buttonOff]}
        >
          <Text style={styles.smallText}>Choose .p12</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!busy) void trust();
          }}
          style={[styles.small, busy && styles.buttonOff]}
        >
          <Text style={styles.smallText}>Choose CA</Text>
        </Pressable>
        <Pressable onPress={forget} style={[styles.small, styles.buttonQuiet]}>
          <Text style={styles.buttonQuietText}>Forget</Text>
        </Pressable>
      </View>

      <View style={styles.inputs}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="passphrase"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.hostInput]}
        />
        <Pressable
          onPress={() => {
            if (!busy) void unlock();
          }}
          style={[
            styles.small,
            (busy || file === undefined) && styles.buttonOff,
          ]}
          disabled={busy || file === undefined}
        >
          <Text style={styles.smallText}>Import</Text>
        </Pressable>
      </View>

      <View style={styles.inputs}>
        <TextInput
          value={typedName}
          onChangeText={(value) => keep({ clientName: value })}
          placeholder={suggestedName ?? "dionysus-search-agent"}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.hostInput]}
        />
      </View>
      <Text style={styles.note}>
        X-Olympus-Client, which the API refuses when it disagrees with the
        certificate&apos;s common name — worth doing on purpose, not by
        accident.
      </Text>

      <Text style={styles.note}>
        {identity === undefined
          ? file === undefined
            ? "No identity. A call still goes out: the listener refusing a caller that presents nothing is a result worth seeing."
            : `${file.name} chosen, not imported yet.`
          : `${identity.subject}${authorities === undefined ? ", validating the server against the system's authorities, which do not include a private CA" : `, trusting ${authorities}`}.`}
      </Text>
      {!usable && clientName !== undefined && (
        <Text style={styles.warning}>
          {clientName} cannot be a client name: lower case letters, digits and
          dashes.
        </Text>
      )}
      {note !== undefined && <Text style={styles.note}>{note}</Text>}

      <View style={styles.inputs}>
        <TextInput
          value={path}
          onChangeText={setPath}
          placeholder="/olympus/ping"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.hostInput]}
        />
        <Pressable
          onPress={() => {
            if (!busy) void call();
          }}
          disabled={caller === undefined || busy}
          style={[
            styles.small,
            (caller === undefined || busy) && styles.buttonOff,
          ]}
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
    </View>
  );
};
