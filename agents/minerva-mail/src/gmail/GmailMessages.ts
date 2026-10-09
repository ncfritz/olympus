import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MailApi } from "@ncfritz/olympus-client";
import { publishMessage } from "@ncfritz/olympus-messages";
import { Injectable, Logger } from "@nestjs/common";
import {
  ClassifierClient,
  type ClassifierMessage,
} from "../classifier/ClassifierClient";
import { mailMessageRoute } from "../messaging";
import { GmailFetchBatch } from "./GmailFetchBatch";
import { type GmailState, toFlags } from "./gmailState";

/**
 * What the agent tells Minerva of Gmail's mail (docs/plans/
 * email-management phase 1b): changes on mail.messages, as the import
 * published, and new mail's text to the classifier when it is configured,
 * to be featurized and scored (phase 5), its suggestions recorded.
 */
@Injectable()
export class GmailMessages {
  private readonly logger = new Logger(GmailMessages.name);
  /** Accounts already reported as having no model, so it is said once. */
  private readonly noModel = new Set<string>();

  constructor(
    private readonly amqp: AmqpConnection,
    private readonly classifier: ClassifierClient,
    private readonly mail: MailApi,
  ) {}

  get featurizing(): boolean {
    return this.classifier.configured;
  }

  batch(accountId: string): GmailFetchBatch {
    return new GmailFetchBatch(this, accountId);
  }

  featurize(accountId: string, messages: ClassifierMessage[]) {
    return this.classifier.putFeatures(accountId, messages);
  }

  /**
   * Scores messages with the account's serving model and records their
   * suggestions; how many messages were recorded, undefined while the
   * account has no model yet.
   */
  async suggest(
    accountId: string,
    messages: ClassifierMessage[],
  ): Promise<number | undefined> {
    const scored = await this.classifier.suggest(accountId, messages);
    if (!scored) {
      if (!this.noModel.has(accountId)) {
        this.noModel.add(accountId);
        this.logger.log(
          `No model serves account ${accountId} yet: new mail is not scored until one is trained`,
        );
      }
      return undefined;
    }
    this.noModel.delete(accountId);
    const recorded = await this.mail.recordMailMessageSuggestions(accountId, {
      modelRun: scored.modelRun,
      featureVersion: scored.featureVersion,
      messages: scored.messages.map((m) => ({
        gmailId: m.gmailId,
        suggestions: m.labels.map((l) => ({
          label: l.label,
          score: l.score,
          ticked: l.ticked,
        })),
      })),
    });
    return recorded.messages;
  }

  warn(message: string): void {
    this.logger.warn(message);
  }

  async publishLabels(
    accountId: string,
    gmailId: string,
    state: GmailState,
    snapshotTime: string,
  ): Promise<void> {
    await this.publish("labels", {
      accountId,
      source: "gmail",
      snapshotTime,
      gmailId,
      labels: state.labels,
      categories: state.categories,
      flags: toFlags(state.flags),
      ...(state.starIcon !== undefined ? { starIcon: state.starIcon } : {}),
    });
  }

  async publishDelete(
    accountId: string,
    gmailId: string,
    snapshotTime: string,
  ): Promise<void> {
    await this.publish("delete", {
      accountId,
      source: "gmail",
      snapshotTime,
      gmailId,
    });
  }

  async publish(
    action: "upsert" | "labels" | "delete",
    message: unknown,
  ): Promise<void> {
    await publishMessage(
      this.amqp,
      mailMessageRoute(action),
      message as never,
      {
        persistent: true,
        contentType: "application/json",
      },
    );
  }
}
