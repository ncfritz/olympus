import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  ClientIdentity,
  type ImportedIdentity,
} from "../modules/client-identity";
import type { NativeRequest } from "./mutualTls";

/**
 * The native module, as the adapter wants it.
 *
 * The annotation is the point: `src/nativeShapes.ts` declares the request and
 * the answer a second time so that the tested modules import nothing from a
 * device, and this assignment is what keeps the two declarations honest -- a
 * change in the module that `nativeShapes` does not follow fails to compile
 * here rather than on a phone.
 */
export const nativeRequest: NativeRequest = (options) =>
  ClientIdentity.request(options);

export type { ImportedIdentity };

const pick = async (): Promise<{ uri: string; name: string } | undefined> => {
  // Every type: iOS wants UTIs rather than MIME types for a PKCS#12, and a
  // filter that quietly matches nothing is worse on a tester than a full list.
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  return asset === undefined ? undefined : { uri: asset.uri, name: asset.name };
};

/** A PKCS#12 from the Files app, as base64. Undefined if the picker was dismissed. */
export const pickIdentityFile = async (): Promise<
  { base64: string; name: string } | undefined
> => {
  const file = await pick();
  if (file === undefined) return undefined;
  return { base64: await new File(file.uri).base64(), name: file.name };
};

/** A PEM bundle of authorities, as text. Undefined if the picker was dismissed. */
export const pickAuthoritiesFile = async (): Promise<
  { pem: string; name: string } | undefined
> => {
  const file = await pick();
  if (file === undefined) return undefined;
  return { pem: await new File(file.uri).text(), name: file.name };
};

export const importIdentity = (
  base64: string,
  password: string,
): Promise<ImportedIdentity> => ClientIdentity.importIdentity(base64, password);

export const trustAuthorities = (pem: string): Promise<number> =>
  ClientIdentity.trustAuthorities(pem);

export const forgetIdentity = (): void => {
  ClientIdentity.forget();
};
