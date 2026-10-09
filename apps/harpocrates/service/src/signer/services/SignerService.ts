import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AxiosError } from "axios";
import * as fs from "fs";
import {
  signerConfig,
  type SignerConfigType,
} from "../../config/configuration";
import {
  type Client,
  createClient,
  createConfig,
} from "../../generated/signer/client";
import * as signer from "../../generated/signer/sdk.gen";
import type {
  CeremonyResponse,
  CertificateSpec,
  CrlSpec,
  ExportFormatName,
  KeyAlgorithm,
  KeyPurpose,
  KeyResponse,
  OfflineCaResponse,
  RevocationReason,
  StatusResponse,
} from "../../generated/signer/types.gen";

export type {
  CeremonyResponse as SignerCeremony,
  CertificateSpec,
  CrlSpec,
  KeyResponse as SignerKey,
  OfflineCaResponse as OfflineCa,
  RevocationReason as SignerRevocationReason,
  StatusResponse as SignerStatus,
};

/** A refusal by one of the signer's invariants: 422, naming it. */
export class SignerRefusal extends UnprocessableEntityException {
  constructor(
    readonly invariant: string,
    message: string,
  ) {
    super(`Refused by the signer (${invariant}): ${message}`);
  }
}

type SignerErrorBody = { error?: string; message?: string; invariant?: string };

/**
 * The signer, over its Unix socket with the shared token (ADR 0020),
 * through the client generated from its committed document. Its errors
 * become Nest's HTTP exceptions, so callers need no special handling.
 */
@Injectable()
export class SignerService {
  private connected?: Client;

  constructor(
    @Inject(signerConfig.KEY) private readonly config: SignerConfigType,
  ) {}

  /** Created on first use, so the token file is read only when needed. */
  private get client(): Client {
    this.connected ??= createClient(
      createConfig({
        baseURL: "http://signer",
        socketPath: this.config.socketPath,
        headers: {
          Authorization: `Bearer ${fs.readFileSync(this.config.tokenFile, "utf8").trim()}`,
        },
        timeout: 30_000,
        // Errors throw, so `call` translates them; otherwise they come
        // back as an AxiosError with no data.
        throwOnError: true,
      }),
    );
    return this.connected;
  }

  status(): Promise<StatusResponse> {
    return this.call(() => signer.describeStatus({ client: this.client }));
  }

  /** Sets the recovery passphrase on an empty store; the unseal key, once. */
  async initialise(passphrase: string): Promise<string> {
    const result = await this.call(() =>
      signer.initialise({ client: this.client, body: { passphrase } }),
    );
    return result.unsealKey;
  }

  unseal(passphrase: string): Promise<void> {
    return this.call(() =>
      signer.unseal({ client: this.client, body: { passphrase } }),
    );
  }

  seal(): Promise<void> {
    return this.call(() => signer.seal({ client: this.client }));
  }

  generateKey(
    purpose: KeyPurpose,
    algorithm: KeyAlgorithm,
  ): Promise<KeyResponse> {
    return this.call(() =>
      signer.generateKey({ client: this.client, body: { purpose, algorithm } }),
    );
  }

  importKey(
    purpose: KeyPurpose,
    privateKey: string,
    passphrase: string,
  ): Promise<KeyResponse> {
    return this.call(() =>
      signer.importKey({
        client: this.client,
        body: { purpose, privateKey, passphrase },
      }),
    );
  }

  destroyKey(keyId: string): Promise<void> {
    return this.call(() =>
      signer.destroyKey({ client: this.client, path: { key_id: keyId } }),
    );
  }

  exportKey(
    keyId: string,
    format: ExportFormatName,
    passphrase: string,
    certificate: string,
    chain: string[],
  ): Promise<Buffer> {
    return this.call(async () => {
      const result = await signer.exportEscrowedKey({
        client: this.client,
        path: { key_id: keyId },
        body: { format, passphrase, certificate, chain },
      });
      return { data: Buffer.from(result.data.data, "base64") };
    });
  }

  async registerIssuer(body: {
    id: string;
    keyId: string;
    certificate: string;
    chain: string[];
    maxValidityDays: number;
    extendedKeyUsages: string[];
  }): Promise<void> {
    await this.call(() => signer.registerIssuer({ client: this.client, body }));
  }

  async signCertificate(
    issuerId: string,
    spec: CertificateSpec,
  ): Promise<string> {
    const signed = await this.call(() =>
      signer.signCertificate({
        client: this.client,
        path: { issuer_id: issuerId },
        body: spec,
      }),
    );
    return signed.certificate;
  }

  async signCrl(issuerId: string, spec: CrlSpec): Promise<string> {
    const signed = await this.call(() =>
      signer.signCrl({
        client: this.client,
        path: { issuer_id: issuerId },
        body: spec,
      }),
    );
    return signed.crl;
  }

  createRoot(
    spec: CertificateSpec,
    algorithm: KeyAlgorithm,
    exportPassphrase: string,
  ): Promise<OfflineCaResponse> {
    return this.call(() =>
      signer.createRootCa({
        client: this.client,
        body: { certificate: spec, algorithm, exportPassphrase },
      }),
    );
  }

  openCeremony(
    privateKey: string,
    passphrase: string,
    certificate: string,
  ): Promise<CeremonyResponse> {
    return this.call(() =>
      signer.openCeremony({
        client: this.client,
        body: { privateKey, passphrase, certificate },
      }),
    );
  }

  closeCeremony(ceremonyId: string): Promise<void> {
    return this.call(() =>
      signer.closeCeremony({
        client: this.client,
        path: { ceremony_id: ceremonyId },
      }),
    );
  }

  async signInCeremony(
    ceremonyId: string,
    spec: CertificateSpec,
  ): Promise<string> {
    const signed = await this.call(() =>
      signer.signCeremonyCertificate({
        client: this.client,
        path: { ceremony_id: ceremonyId },
        body: spec,
      }),
    );
    return signed.certificate;
  }

  async signCrlInCeremony(ceremonyId: string, spec: CrlSpec): Promise<string> {
    const signed = await this.call(() =>
      signer.signCeremonyCrl({
        client: this.client,
        path: { ceremony_id: ceremonyId },
        body: spec,
      }),
    );
    return signed.crl;
  }

  createIntermediate(
    ceremonyId: string,
    spec: CertificateSpec,
    algorithm: KeyAlgorithm,
    exportPassphrase: string,
  ): Promise<OfflineCaResponse> {
    return this.call(() =>
      signer.createIntermediateCa({
        client: this.client,
        path: { ceremony_id: ceremonyId },
        body: { certificate: spec, algorithm, exportPassphrase },
      }),
    );
  }

  /** Runs a call, returning its data and translating the signer's errors. */
  private async call<T>(request: () => Promise<{ data: T }>): Promise<T> {
    try {
      return (await request()).data;
    } catch (error: unknown) {
      throw translate(error);
    }
  }
}

const translate = (error: unknown): HttpException => {
  if (!(error instanceof AxiosError)) {
    return new InternalServerErrorException("The signer call failed");
  }
  if (!error.response) {
    return new ServiceUnavailableException("The signer is unreachable");
  }
  const body = (error.response.data ?? {}) as SignerErrorBody;
  const message = body.message ?? `HTTP ${error.response.status}`;
  switch (error.response.status) {
    case 400:
      return new BadRequestException(message);
    case 403:
      return new ForbiddenException(message);
    case 404:
      return new NotFoundException(message);
    case 409:
      return new ConflictException(message);
    case 422:
      return new SignerRefusal(body.invariant ?? "unknown", message);
    case 503:
      return new ServiceUnavailableException(
        `The signer is sealed: ${message}`,
      );
    default:
      // 401 means this service holds the wrong token: a deployment fault.
      return new InternalServerErrorException(
        `The signer answered ${error.response.status}`,
      );
  }
};
