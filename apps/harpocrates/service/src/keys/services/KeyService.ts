import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Key, KeyLocation, KeyPurpose, Prisma } from "@prisma/client";
import { bytes, keyAlgorithm, rsaModulus, spkiSha256 } from "../../pki/x509";
import { PrismaService } from "../../store/PrismaService";
import { weakness } from "../weakKeys";

/**
 * Every key Harpocrates has seen, once (ADR 0020, Keys and enrollment):
 * a SubjectPublicKeyInfo hash is unique across CAs, subjects and SSH.
 */
@Injectable()
export class KeyService {
  constructor(private readonly prisma: PrismaService) {}

  findBySpki(spki: Buffer, tx: Prisma.TransactionClient = this.prisma) {
    return tx.key.findUnique({ where: { spkiSha256: spkiSha256(spki) } });
  }

  /** Refuses a known-weak key (ROCA, close primes). */
  checkNotWeak(spki: Buffer): void {
    const reason = weakness(rsaModulus(spki));
    if (reason) throw new UnprocessableEntityException(reason);
  }

  /** Records a key; a key already seen is a conflict, whatever it was. */
  async record(
    tx: Prisma.TransactionClient,
    key: {
      spki: Buffer;
      purpose: KeyPurpose;
      location: KeyLocation;
      signerKeyId?: string;
    },
  ): Promise<Key> {
    const hash = spkiSha256(key.spki);
    if (await tx.key.findUnique({ where: { spkiSha256: hash } })) {
      throw new ConflictException("This key is already known to Harpocrates");
    }
    return tx.key.create({
      data: {
        spkiSha256: hash,
        publicKey: bytes(key.spki),
        algorithm: keyAlgorithm(key.spki),
        purpose: key.purpose,
        location: key.location,
        signerKeyId: key.signerKeyId,
      },
    });
  }
}
