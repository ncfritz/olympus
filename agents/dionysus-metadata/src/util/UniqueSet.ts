export class UniqueSet<T> extends Set<T> {
  add(o: T) {
    for (const i of this) {
      if (this.deepCompare(o, i)) {
        return this;
      }
    }

    super.add.call(this, o);

    return this;
  }

  private deepCompare(o: T, i: T) {
    return JSON.stringify(o) === JSON.stringify(i);
  }
}
