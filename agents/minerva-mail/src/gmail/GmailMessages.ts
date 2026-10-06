import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
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
 * published, and new mail's text to the classifier when it is configured.
 */
@Injectable()
export class GmailMessages {
  private readonly logger = new Logger(GmailMessages.name);

  constructor(
    private readonly amqp: AmqpConnection,
    private readonly classifier: ClassifierClient,
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
