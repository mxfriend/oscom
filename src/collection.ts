import { EventMapExtension } from '@mxfriend/osc';
import { Child, Container, ContainerEvents } from './container';
import { Node } from './node';

export type ItemFactory<T extends Node = any> = {
  (idx: number): T;
};

const $factory = Symbol('factory');
const $items = Symbol('items');
const $pad = Symbol('pad');

export class Collection<
  T extends Node = any,
  TEvents extends EventMapExtension<ContainerEvents> = {},
> extends Container<TEvents> {
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
      if (/^\d+$/.test(prop)) {
        prop = parseInt(prop.replace(/^0+(?!$)/, '')) - 1;
      } else {
        return super.$get(prop);
      }
    }

    const existing = this[$items][prop];

    if (existing !== undefined) {
      return existing;
    } else if (prop < 0 || prop >= this[$items].length) {
      throw new Error(`Container index out of range: ${prop}`);
    }

    const value = this[$items][prop] = this[$factory](prop);
    this.$attach(prop, value);
    return value;
  }

  $set<P extends string>(prop: P, node: Child<this, P>): void;
  $set(item: number, node: T): void;
  $set(prop: string | number, node: any): void {
    if (typeof prop === 'string') {
      if (/^\d+$/.test(prop)) {
        prop = parseInt(prop.replace(/^0+(?!$)/, '')) - 1;
      } else {
        return super.$set(prop, node);
      }
    }

    if (prop < 0 || prop >= this[$items].length) {
      throw new Error(`Container index out of range: ${prop}`);
    }

    const existing = this[$items][prop];

    if (existing) {
      this.$detach(existing);
      existing.$destroy();
      delete this[$items][prop];
    }

    this[$items][prop] = node;
    this.$attach(prop, node);
  }

  $has(prop: string | number): boolean {
    if (typeof prop === 'string' && /^\d+$/.test(prop)) {
      prop = parseInt(prop.replace(/^0+(?!$)/, '')) - 1;
    }

    return typeof prop === 'number' ? prop >= 0 && prop < this[$items].length : super.$has(prop);
  }

  $attach(prop: string | number, value: Node) {
    if (typeof prop === 'number') {
      const idx = (prop + 1).toString();
      super.$attach(this[$pad] ? idx.padStart(this[$pad], '0') : idx, value);
    } else {
      super.$attach(prop, value);
    }
  }

  * [Symbol.iterator](): IterableIterator<Node> {
    yield * super[Symbol.iterator]();
    yield * this.$items();
  }

  * $entries(lazy: boolean = false): IterableIterator<[string | number, Node]> {
    yield * super.$entries(lazy);

    for (let i = 0; i < this[$items].length; ++i) {
      if (!lazy || this[$items][i] !== undefined) {
        yield [i, this.$get(i)];
      }
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
