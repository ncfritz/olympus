import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  GMAIL_SETTINGS_SCOPE,
  gmailConfig,
  type GmailConfigType,
} from "../config/configuration";
import type { CreateGmailFilterRequest } from "../model/gmail";
import { GmailClient, type GmailMailbox, gmailStatusOf } from "./GmailClient";
import { GmailCredentialStore } from "./GmailCredentialStore";

const ADDRESS = /^[^@\s]+@[^@\s]+$/;
const FILTER_ID = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Gmail filters for the API (docs/plans/email-management phase 7 step 4):
 * mail from one sender gets a label, and skips the inbox when asked, as it
 * arrives. Needs MAIL_FILTERS_ENABLED and a mailbox linked with
 * gmail.settings.basic.
 */
@Injectable()
export class GmailFilters {
  constructor(
    @Inject(gmailConfig.KEY) private readonly config: GmailConfigType,
    private readonly gmail: GmailClient,
    private readonly credentials: GmailCredentialStore,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.clientId && this.config.filtersEnabled);
  }

  /**
   * Makes the filter; Gmail's ID for it.
   *
   * @throws BadRequestException the request is not what it should be
   * @throws ConflictException the mailbox is not linked for filters
   * @throws NotFoundException Gmail has no such user label
   */
  async create(
    request: CreateGmailFilterRequest,
    open: (email: string) => GmailMailbox = (e) => this.gmail.mailbox(e),
  ): Promise<string> {
    if (
      !request ||
      typeof request.email !== "string" ||
      !ADDRESS.test(request.email) ||
      typeof request.from !== "string" ||
      !ADDRESS.test(request.from) ||
      typeof request.label !== "string" ||
      request.label.length < 1 ||
      request.label.length > 225 ||
      typeof request.skipInbox !== "boolean"
    ) {
      throw new BadRequestException(
        "email, from (an address), label and skipInbox are required",
      );
    }
    const mailbox = this.linked(request.email, open);
    const label = (await mailbox.labels()).find(
      (l) => l.type === "user" && l.name === request.label,
    );
    if (!label) {
      throw new NotFoundException(`Gmail has no label ${request.label}`);
    }
    return mailbox.createFilter(
      request.from,
      [label.id],
      request.skipInbox ? ["INBOX"] : [],
    );
  }

  /**
   * Deletes the filter; one Gmail no longer has is gone already.
   *
   * @throws ConflictException the mailbox is not linked for filters
   */
  async delete(
    email: string,
    filterId: string,
    open: (email: string) => GmailMailbox = (e) => this.gmail.mailbox(e),
  ): Promise<void> {
    if (typeof email !== "string" || !ADDRESS.test(email)) {
      throw new BadRequestException("email must be the mailbox's address");
    }
    if (typeof filterId !== "string" || !FILTER_ID.test(filterId)) {
      throw new BadRequestException("filterId must be a Gmail filter ID");
    }
    try {
      await this.linked(email, open).deleteFilter(filterId);
    } catch (error) {
      if (gmailStatusOf(error) !== 404) throw error;
    }
  }

  private linked(
    email: string,
    open: (email: string) => GmailMailbox,
  ): GmailMailbox {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        "Gmail filters are turned off at the mail agent (MAIL_FILTERS_ENABLED)",
      );
    }
    const credential = this.credentials.load(email);
    if (!credential?.scope.split(" ").includes(GMAIL_SETTINGS_SCOPE)) {
      throw new ConflictException(
        "The mailbox is not linked for filters: allow filters from the Inbox first",
      );
    }
    return open(email);
  }
}
