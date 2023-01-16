import { Child, Container } from './container';
import { Value } from './values';

export type ItemFactory<T extends Container | Value = any> = {
  (idx: number): T;
};

const $factory = Symbol('factory');
const $items = Symbol('items');
const $pad = Symbol('pad');

export class Collection<T extends Container | Value = any> extends Container {
  private readonly [$factory]: ItemFactory<T>;
  private readonly [$items]: T[];
  private readonly [$pad]?: number;

  constructor(factory: ItemFactory<T>, size: number, callable?: boolean);
  constructor(factory: ItemFactory<T>, size: number, pad: number, callable?: boolean);
  constructor(factory: ItemFactory<T>, size: number, padOrCallable?: number | boolean, maybeCallable?: boolean) {
    const [pad, callable] = typeof padOrCallable === 'boolean'
      ? [undefined, padOrCallable]
      : [padOrCallable, maybeCallable];

    super(callable);
    this[$factory] = factory;
    this[$items] = new Array(size);
    this[$pad] = pad;
  }

  $get<P extends string>(prop: P): Child<this, P>;
  $get(prop: number): T;
  $get(prop: string | number): any {
    if (typeof prop === 'string') {
      return super.$get(prop);
    }

    const existing = this[$items][prop];

    if (existing) {
      return existing;
    }

    const value = this[$items][prop] = this[$factory](prop);
    this.$attach(prop, value);
    return value;
  }

  $set<P extends string>(prop: P, node: Child<this, P>): void;
  $set(item: number, node: T): void;
  $set(prop: string | number, node: any): void {
    if (typeof prop === 'string') {
      return super.$set(prop, node);
    }

    const existing = this[$items][prop];

    if (existing) {
      this.$detach(existing);
      delete this[$items][prop];
    }

    this[$items][prop] = node;
    this.$attach(prop, node);
  }

  $attach(prop: string | number, value: Container | Value) {
    if (typeof prop === 'number') {
      const idx = (prop + 1).toString();
      super.$attach(this[$pad] ? idx.padStart(this[$pad], '0') : idx, value);
    } else {
      super.$attach(prop, value);
    }
  }

  $slice(start?: number, end?: number): T[] {
    return this[$items].slice(start, end);
  }

  $splice(start: number, deleteCount: number, ...items: T[]): T[] {
    const removed = this[$items].splice(start, deleteCount, ...items);

    for (const item of removed) {
      this.$detach(item);
    }

    let i = start;

    for (const item of items) {
      this.$attach(i++, item);
    }

    return removed;
  }

  * [Symbol.iterator](): IterableIterator<Container | Value> {
    yield * super[Symbol.iterator]();
    yield * this.$items();
  }

  * $entries(): IterableIterator<[string | number, Container | Value]> {
    yield * super.$entries();

    for (let i = 0; i < this[$items].length; ++i) {
      yield [i, this.$get(i)];
    }
  }

  * $keys(): IterableIterator<number> {
    for (let i = 0; i < this[$items].length; ++i) {
      yield i;
    }
  }

  * $items(): IterableIterator<T> {
    for (let i = 0; i < this[$items].length; ++i) {
      yield this.$get(i);
    }
  }
}
