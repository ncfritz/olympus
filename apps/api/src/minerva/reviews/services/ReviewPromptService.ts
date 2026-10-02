import {
  BaseReviewPrompt,
  PartialReviewPrompt,
  ReviewKind,
  ReviewPrompt,
  ReviewPromptSection,
  ReviewPromptStyle,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { isUniqueViolation } from "../../utils/hasuraErrors";
import {
  checkEnum,
  checkOptionalText,
  isStringList,
} from "../../utils/validation";
import {
  GraphQlReviewPrompt,
  toDomainObject,
} from "../converters/ReviewPromptConverter";
import { REVIEW_PROMPT } from "../queries/reviews";

const MAX_LABEL = 120;
const MAX_PLACEHOLDER = 200;

type StarterPrompt = {
  kind: ReviewKind;
  section: ReviewPromptSection;
  /** Text when left out. */
  style?: ReviewPromptStyle;
  label: string;
  placeholder?: string;
};

/**
 * The prompts a user starts with, in order within each kind and section
 * (docs/plans/activity-review/README.md, phase 1).
 */
export const STARTER_PROMPTS: ReadonlyArray<StarterPrompt> = [
  {
    kind: ReviewKind.Daily,
    section: ReviewPromptSection.Reflect,
    style: ReviewPromptStyle.List,
    label: "What went well?",
  },
  {
    kind: ReviewKind.Daily,
    section: ReviewPromptSection.Reflect,
    style: ReviewPromptStyle.List,
    label: "What didn’t go well?",
  },
  {
    kind: ReviewKind.Daily,
    section: ReviewPromptSection.Reflect,
    style: ReviewPromptStyle.List,
    label: "What’s on my mind?",
    placeholder: "Something you keep coming back to, a worry, an open question",
  },
  {
    kind: ReviewKind.Daily,
    section: ReviewPromptSection.Reflect,
    label: "Anything else about today",
    placeholder:
      "How you felt, what you noticed, what you’d tell yourself tomorrow",
  },
  {
    kind: ReviewKind.Daily,
    section: ReviewPromptSection.Plan,
    style: ReviewPromptStyle.List,
    label: "Thoughts for tomorrow",
  },
  {
    kind: ReviewKind.Weekly,
    section: ReviewPromptSection.Reflect,
    style: ReviewPromptStyle.List,
    label: "Biggest win",
  },
  {
    kind: ReviewKind.Weekly,
    section: ReviewPromptSection.Reflect,
    style: ReviewPromptStyle.List,
    label: "What got in the way",
  },
  {
    kind: ReviewKind.Weekly,
    section: ReviewPromptSection.Reflect,
    style: ReviewPromptStyle.List,
    label: "What I learned",
    placeholder: "Something about how you work, a pattern in the dailies",
  },
  {
    kind: ReviewKind.Weekly,
    section: ReviewPromptSection.Reflect,
    style: ReviewPromptStyle.List,
    label: "What to change next week",
    placeholder: "One concrete change to carry into next week’s plan",
  },
  {
    kind: ReviewKind.Weekly,
    section: ReviewPromptSection.Plan,
    label: "Theme for the week",
  },
  {
    kind: ReviewKind.Weekly,
    section: ReviewPromptSection.Plan,
    label: "Start",
  },
  {
    kind: ReviewKind.Weekly,
    section: ReviewPromptSection.Plan,
    label: "Stop",
  },
];

type PromptValues = {
  kind: ReviewKind;
  section: ReviewPromptSection;
  style: ReviewPromptStyle;
  label: string;
  placeholder: string | null;
};

type PromptChanges = {
  label?: string;
  style?: ReviewPromptStyle;
  placeholder?: string | null;
  archived?: boolean;
};

type PromptSet = Partial<
  Pick<PromptValues, "label" | "style" | "placeholder">
> & {
  archivedTime?: string | null;
};

/**
 * A user's review prompts in Hasura (ADR 0027). Every method takes the
 * caller's user ID and scopes by it, so another user's prompt is simply not
 * found.
 */
@Injectable()
export class ReviewPromptService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The user's prompts, archived ones included: daily before weekly, Reflect
   * before Plan, each in its order. The first time a user's prompts are
   * read they are given the starter set, once: a user who later deletes
   * them all keeps none.
   */
  async list(userId: string, kind?: unknown): Promise<ReviewPrompt[]> {
    if (kind !== undefined) {
      const problems: string[] = [];
      checkEnum(kind, ReviewKind, "kind", problems);
      if (problems.length) throw new BadRequestException(problems);
    }
    const document = gql`
      query ListReviewPrompts($userId: uuid!) {
        minerva_review_prompts(
          where: { userId: { _eq: $userId } }
          order_by: [{ kind: asc }, { section: desc }, { position: asc }]
        ) {
          ${REVIEW_PROMPT}
        }
        minerva_review_user_settings_by_pk(userId: $userId) {
          starterPromptsTime
        }
      }
    `;
    type Result = {
      minerva_review_prompts: GraphQlReviewPrompt[];
      minerva_review_user_settings_by_pk: {
        starterPromptsTime: string | null;
      } | null;
    };
    const read = () => this.graphQLClient.request<Result>(document, { userId });

    let result = await read();
    if (result.minerva_review_user_settings_by_pk === null) {
      await this.giveStarterPrompts(userId, result.minerva_review_prompts);
      result = await read();
    }
    return result.minerva_review_prompts
      .map(toDomainObject)
      .filter((prompt) => kind === undefined || prompt.kind === kind);
  }

  /** One of the user's prompts. */
  async describe(userId: string, promptId: string): Promise<ReviewPrompt> {
    const document = gql`
      query DescribeReviewPrompt($userId: uuid!, $promptId: uuid!) {
        minerva_review_prompts(
          where: { id: { _eq: $promptId }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${REVIEW_PROMPT}
        }
      }
    `;
    type Result = { minerva_review_prompts: GraphQlReviewPrompt[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      promptId,
    });
    const row = result.minerva_review_prompts[0];
    if (!row) throw notFound(promptId);
    return toDomainObject(row);
  }

  /** Adds a prompt at the end of its kind and section. */
  async create(
    userId: string,
    prompt: BaseReviewPrompt | undefined,
  ): Promise<ReviewPrompt> {
    const values = validateBase(prompt);
    // Through list, so the starter set is given first and the new prompt
    // follows it.
    const current = (await this.list(userId)).filter(
      (p) => p.kind === values.kind && p.section === values.section,
    );
    const position = Math.max(-1, ...current.map((p) => p.position)) + 1;

    const document = gql`
      mutation CreateReviewPrompt($object: minerva_review_prompts_insert_input!) {
        insert_minerva_review_prompts_one(object: $object) {
          ${REVIEW_PROMPT}
        }
      }
    `;
    type Result = { insert_minerva_review_prompts_one: GraphQlReviewPrompt };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: { userId, ...values, position },
      });
      return toDomainObject(result.insert_minerva_review_prompts_one);
    } catch (error) {
      // Two prompts added to one section at once: the second takes the
      // same position and is refused rather than racing ahead.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "Another prompt was added to that section at the same time; try again",
        );
      }
      throw error;
    }
  }

  /**
   * Changes a prompt: its label, its style, its placeholder, or whether
   * it is archived. A prompt becomes text only while no review holds more
   * than one item for it. Answers `undefined` when the body names nothing to change.
   */
  async update(
    userId: string,
    promptId: string,
    changes: PartialReviewPrompt | undefined,
  ): Promise<ReviewPrompt | undefined> {
    const changed = validatePartial(changes);
    const current = await this.describe(userId, promptId);
    if (Object.keys(changed).length === 0) return undefined;

    const set: PromptSet = {};
    if (changed.label !== undefined && changed.label !== current.label) {
      set.label = changed.label;
    }
    if (changed.style !== undefined && changed.style !== current.style) {
      if (changed.style === ReviewPromptStyle.Text) {
        await this.refuseListsOf(userId, promptId);
      }
      set.style = changed.style;
    }
    if (
      changed.placeholder !== undefined &&
      changed.placeholder !== (current.placeholder ?? null)
    ) {
      set.placeholder = changed.placeholder;
    }
    if (
      changed.archived !== undefined &&
      changed.archived !== current.archived
    ) {
      set.archivedTime = changed.archived ? new Date().toISOString() : null;
    }
    if (Object.keys(set).length === 0) return current;

    const document = gql`
      mutation UpdateReviewPrompt(
        $userId: uuid!
        $promptId: uuid!
        $set: minerva_review_prompts_set_input!
      ) {
        update_minerva_review_prompts(
          where: { id: { _eq: $promptId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${REVIEW_PROMPT}
          }
        }
      }
    `;
    type Result = {
      update_minerva_review_prompts: { returning: GraphQlReviewPrompt[] };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      promptId,
      set,
    });
    const row = result.update_minerva_review_prompts.returning[0];
    if (!row) throw notFound(promptId);
    return toDomainObject(row);
  }

  /**
   * Removes one of the user's prompts. A prompt with answers is refused:
   * archive it instead, so the reviews that answered it keep it.
   */
  async delete(userId: string, promptId: string): Promise<void> {
    const useDocument = gql`
      query GetReviewPromptUse($userId: uuid!, $promptId: uuid!) {
        minerva_review_prompts(
          where: { id: { _eq: $promptId }, userId: { _eq: $userId } }
        ) {
          id
        }
        minerva_review_answers_aggregate(
          where: { promptId: { _eq: $promptId }, userId: { _eq: $userId } }
        ) {
          aggregate {
            count
          }
        }
      }
    `;
    type UseResult = {
      minerva_review_prompts: { id: string }[];
      minerva_review_answers_aggregate: { aggregate: { count: number } };
    };
    const use = await this.graphQLClient.request<UseResult>(useDocument, {
      userId,
      promptId,
    });
    if (use.minerva_review_prompts.length === 0) throw notFound(promptId);
    const answers = use.minerva_review_answers_aggregate.aggregate.count;
    if (answers > 0) {
      throw new ConflictException(
        `The prompt has ${answers} answer${answers === 1 ? "" : "s"}; archive it instead`,
      );
    }

    const document = gql`
      mutation DeleteReviewPrompt($userId: uuid!, $promptId: uuid!) {
        delete_minerva_review_prompts(
          where: { id: { _eq: $promptId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_review_prompts: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      promptId,
    });
    if (result.delete_minerva_review_prompts.affected_rows === 0) {
      throw notFound(promptId);
    }
  }

  /**
   * Puts the prompts of one kind and section in the order given, which must
   * name every one of them, archived ones included, exactly once. Answers
   * all of the user's prompts.
   */
  async reorder(
    userId: string,
    kind: unknown,
    section: unknown,
    promptIds: unknown,
  ): Promise<ReviewPrompt[]> {
    const problems: string[] = [];
    checkEnum(kind, ReviewKind, "kind", problems);
    checkEnum(section, ReviewPromptSection, "section", problems);
    if (!isStringList(promptIds)) {
      problems.push("promptIds must be a list of IDs");
    }
    if (problems.length) throw new BadRequestException(problems);
    const ids = promptIds as string[];

    const current = (await this.list(userId)).filter(
      (p) => p.kind === kind && p.section === section,
    );
    const given = new Set(ids);
    if (
      given.size !== ids.length ||
      given.size !== current.length ||
      current.some((prompt) => !given.has(prompt.id))
    ) {
      throw new BadRequestException(
        `promptIds must name each of your ${String(kind)} ${String(section)} prompts exactly once`,
      );
    }

    // The position constraint is deferred, so the rows may collide on the
    // way to their new places and are checked when the mutation commits.
    const document = gql`
      mutation ReorderReviewPrompts(
        $updates: [minerva_review_prompts_updates!]!
      ) {
        update_minerva_review_prompts_many(updates: $updates) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      updates: ids.map((id, position) => ({
        where: { id: { _eq: id }, userId: { _eq: userId } },
        _set: { position },
      })),
    });
    return this.list(userId);
  }

  /**
   * Refuses to make a prompt text while a review holds more than one item
   * for it: a text prompt has one answer per review.
   */
  private async refuseListsOf(userId: string, promptId: string) {
    const document = gql`
      query GetReviewPromptAnswerCounts($userId: uuid!, $promptId: uuid!) {
        minerva_review_answers(
          where: {
            promptId: { _eq: $promptId }
            userId: { _eq: $userId }
            position: { _gt: 0 }
          }
          limit: 1
        ) {
          id
        }
      }
    `;
    type Result = { minerva_review_answers: { id: string }[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      promptId,
    });
    if (result.minerva_review_answers.length) {
      throw new ConflictException(
        "A review holds more than one item for the prompt, so it stays a list",
      );
    }
  }

  /**
   * Records the user's settings and inserts the starter prompts after any
   * they already have in each section, in one transaction. A concurrent
   * first read that got there first makes the settings insert a conflict,
   * and this one gives nothing.
   */
  private async giveStarterPrompts(
    userId: string,
    existing: GraphQlReviewPrompt[],
  ): Promise<void> {
    const next = new Map<string, number>();
    for (const prompt of existing) {
      const key = `${prompt.kind}/${prompt.section}`;
      next.set(key, Math.max(next.get(key) ?? 0, prompt.position + 1));
    }
    const objects = STARTER_PROMPTS.map((prompt) => {
      const key = `${prompt.kind}/${prompt.section}`;
      const position = next.get(key) ?? 0;
      next.set(key, position + 1);
      return {
        userId,
        kind: prompt.kind,
        section: prompt.section,
        style: prompt.style ?? ReviewPromptStyle.Text,
        label: prompt.label,
        placeholder: prompt.placeholder ?? null,
        position,
      };
    });

    const document = gql`
      mutation GiveStarterReviewPrompts(
        $settings: minerva_review_user_settings_insert_input!
        $objects: [minerva_review_prompts_insert_input!]!
      ) {
        insert_minerva_review_user_settings_one(object: $settings) {
          userId
        }
        insert_minerva_review_prompts(objects: $objects) {
          affected_rows
        }
      }
    `;
    try {
      await this.graphQLClient.request(document, {
        settings: { userId, starterPromptsTime: new Date().toISOString() },
        objects,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
}

const notFound = (promptId: string) =>
  new NotFoundException(`Review prompt with id ${promptId} not found`);

const checkLabel = (value: unknown, problems: string[]): string => {
  const label = typeof value === "string" ? value.trim() : "";
  if (!label || label.length > MAX_LABEL) {
    problems.push(`label must be 1 to ${MAX_LABEL} characters`);
  }
  return label;
};

const validateBase = (prompt: BaseReviewPrompt | undefined): PromptValues => {
  if (!prompt || typeof prompt !== "object") {
    throw new BadRequestException("reviewPrompt is required");
  }
  const problems: string[] = [];
  const values: PromptValues = {
    kind: checkEnum(prompt.kind, ReviewKind, "kind", problems),
    section: checkEnum(
      prompt.section,
      ReviewPromptSection,
      "section",
      problems,
    ),
    style:
      prompt.style === undefined
        ? ReviewPromptStyle.Text
        : checkEnum(prompt.style, ReviewPromptStyle, "style", problems),
    label: checkLabel(prompt.label, problems),
    placeholder: checkOptionalText(
      prompt.placeholder,
      "placeholder",
      MAX_PLACEHOLDER,
      problems,
    ),
  };
  if (problems.length) throw new BadRequestException(problems);
  return values;
};

const validatePartial = (
  changes: PartialReviewPrompt | undefined,
): PromptChanges => {
  if (!changes || typeof changes !== "object") {
    throw new BadRequestException("reviewPrompt is required");
  }
  const problems: string[] = [];
  const changed: PromptChanges = {};
  if (changes.label !== undefined) {
    changed.label = checkLabel(changes.label, problems);
  }
  if (changes.style !== undefined) {
    changed.style = checkEnum(
      changes.style,
      ReviewPromptStyle,
      "style",
      problems,
    );
  }
  if (changes.placeholder !== undefined) {
    changed.placeholder = checkOptionalText(
      changes.placeholder,
      "placeholder",
      MAX_PLACEHOLDER,
      problems,
    );
  }
  if (changes.archived !== undefined) {
    if (typeof changes.archived !== "boolean") {
      problems.push("archived must be true or false");
    } else {
      changed.archived = changes.archived;
    }
  }
  if (problems.length) throw new BadRequestException(problems);
  return changed;
};
