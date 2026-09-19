import { describe, expect, it } from "vitest";
import { EmailTemplates } from "../../../../src/channels/email/services/EmailTemplates";

describe("EmailTemplates", () => {
  const templates = new EmailTemplates();

  it("compiles each template once", () => {
    expect(templates.get("email/system_test/subject.handlebars")).toBe(
      templates.get("email/system_test/subject.handlebars"),
    );
  });

  it("reports missing templates", () => {
    expect(templates.find("email/system_test/css.handlebars")).toBeUndefined();
    expect(() => templates.get("email/nope/html.handlebars")).toThrow(
      /No template exists/,
    );
  });

  it("gives templates that use no partials no layout images", () => {
    expect(
      templates.get("email/system_test/plaintext.handlebars").attachments,
    ).toEqual([]);
  });
});
