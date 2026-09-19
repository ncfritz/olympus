import type { RecordSource } from "./RecordSource";

/** Records loaded into memory at once (TMDB's small reference lists). */
export class ListSource<R> implements RecordSource<R> {
  private records: R[] = [];
  private position = 0;

  constructor(private readonly load: () => Promise<R[]>) {}

  async init(): Promise<void> {
    this.records = await this.load();
    this.position = 0;
  }

  async next(): Promise<R | undefined> {
    if (this.position === this.records.length) {
      return undefined;
    }

    const record = this.records[this.position];
    this.position++;

    return record;
  }

  count(): number {
    return this.records.length;
  }

  async cleanup(): Promise<void> {
    this.records = [];
    this.position = 0;
  }
}
