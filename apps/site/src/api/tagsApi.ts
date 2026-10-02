import {
  client,
  createTag,
  deleteTag,
  listTags,
  type Tag,
  updateTag,
} from "@ncfritz/olympus-sdk/minerva";

/**
 * Minerva's shared tags through the API: the signed-in user's own, used
 * by goals now and notes later.
 */
class TagsApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async listTags(prefix?: string): Promise<Tag[]> {
    const { data } = await listTags({ query: prefix ? { prefix } : undefined });
    return data.tags;
  }

  async createTag(name: string, color?: string): Promise<Tag> {
    const { data } = await createTag({ body: { tag: { name, color } } });
    return data.tag;
  }

  async updateTag(
    tagId: string,
    changes: { name?: string; color?: string | null },
  ): Promise<void> {
    await updateTag({
      path: { tagId },
      body: { tag: changes as { name?: string; color?: string } },
      validateStatus: (status) => status === 200 || status === 304,
    });
  }

  async deleteTag(tagId: string): Promise<void> {
    await deleteTag({ path: { tagId } });
  }
}

const tagsApi = new TagsApi();

export default tagsApi;
