import { Injectable, Logger } from "@nestjs/common";
import Handlebars from "handlebars";
import helpers from "handlebars-helpers";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Attachment } from "nodemailer/lib/mailer";
import { findTemplatesDir } from "../templates";

type Hbs = typeof Handlebars;
type HbsNode = { type: string; [key: string]: unknown };

/** A compiled template with the inline images it (and its partials) use. */
export type CompiledTemplate = {
  render: Handlebars.TemplateDelegate;
  attachments: Attachment[];
};

/**
 * The email templates in `templates/`: an isolated Handlebars environment
 * with handlebars-helpers and the partials in `templates/partials/email`,
 * loaded once. A template's attachments are those listed in
 * `<name>.attachments.json` next to it and next to every partial it uses
 * (paths relative to the package root).
 */
@Injectable()
export class EmailTemplates {
  private readonly logger = new Logger(EmailTemplates.name);
  private readonly handlebars: Hbs = Handlebars.create();
  private readonly partialSources = new Map<string, string>();
  private readonly partialAttachments = new Map<string, Attachment[]>();
  private readonly compiled = new Map<string, CompiledTemplate | undefined>();

  /** The package's templates/ directory. */
  readonly dir = findTemplatesDir();

  constructor() {
    this.handlebars.registerHelper(helpers());

    const partialsDir = path.join(this.dir, "partials", "email");
    for (const file of fs.readdirSync(partialsDir)) {
      if (!file.endsWith(".handlebars")) continue;
      const name = path.basename(file, ".handlebars");
      const source = fs.readFileSync(path.join(partialsDir, file), "utf8");
      this.handlebars.registerPartial(name, source);
      this.partialSources.set(name, source);
      this.partialAttachments.set(
        name,
        this.attachmentsFor(path.join(partialsDir, file)),
      );
    }
    this.logger.debug(
      `Loaded ${this.partialSources.size} partials from ${partialsDir}`,
    );
  }

  /** `relativePath` under templates/, compiled once; throws if missing. */
  get(relativePath: string): CompiledTemplate {
    const template = this.find(relativePath);
    if (!template) {
      throw new Error(
        `No template exists at ${path.join(this.dir, relativePath)}`,
      );
    }
    return template;
  }

  /** Like get(), but undefined when the template doesn't exist. */
  find(relativePath: string): CompiledTemplate | undefined {
    if (!this.compiled.has(relativePath)) {
      this.compiled.set(relativePath, this.load(relativePath));
    }
    return this.compiled.get(relativePath);
  }

  private load(relativePath: string): CompiledTemplate | undefined {
    const file = path.join(this.dir, relativePath);
    if (!fs.existsSync(file)) return undefined;
    this.logger.debug(`Compiling template ${file}`);
    const source = fs.readFileSync(file, "utf8");
    const attachments = [
      ...this.attachmentsFor(file),
      ...[...this.partialsUsedBy(source)].flatMap(
        (name) => this.partialAttachments.get(name) ?? [],
      ),
    ];
    return { render: this.handlebars.compile(source), attachments };
  }

  /** Registered partials a template uses, directly or through partials. */
  private partialsUsedBy(source: string, found = new Set<string>()) {
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      const n = node as HbsNode;
      if (
        (n.type === "PartialStatement" || n.type === "PartialBlockStatement") &&
        (n.name as HbsNode).type === "PathExpression"
      ) {
        const name = (n.name as { original: string }).original;
        const partial = this.partialSources.get(name);
        if (partial !== undefined && !found.has(name)) {
          found.add(name);
          this.partialsUsedBy(partial, found);
        }
      }
      for (const [key, value] of Object.entries(n)) {
        if (key !== "loc" && value && typeof value === "object") visit(value);
      }
    };
    visit(this.handlebars.parse(source));
    return found;
  }

  /** The attachments listed in `<template>.attachments.json`, if any. */
  private attachmentsFor(file: string): Attachment[] {
    const parsed = path.parse(file);
    const metadata = path.join(parsed.dir, `${parsed.name}.attachments.json`);
    if (!fs.existsSync(metadata)) return [];
    const listed: Attachment[] =
      JSON.parse(fs.readFileSync(metadata, "utf8")).attachments ?? [];
    return listed.map((attachment) =>
      typeof attachment.path === "string" && !path.isAbsolute(attachment.path)
        ? {
            ...attachment,
            path: path.join(path.dirname(this.dir), attachment.path),
          }
        : attachment,
    );
  }
}
