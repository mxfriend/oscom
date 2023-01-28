import { OSCArgument } from '@mxfriend/osc';
import { Container, ContainerEvents } from './container';
import { Node } from './node';

export type ItemFactory<T extends Node = any> = {
  (idx: number): T;
};

const $factory = Symbol('factory');
const $items = Symbol('items');
const $base = Symbol('base');
const $pad = Symbol('pad');

export type CollectionOptions = {
  size: number;
  base?: number;
  pad?: number;
  callable?: boolean;
};

export class Collection<
  T extends Node = Node,
  TEvents extends ContainerEvents = ContainerEvents,
> extends Container<TEvents> {
  private readonly [$factory]: ItemFactory<T>;
  private readonly [$items]: T[];
  private readonly [$base]: number;
  private readonly [$pad]?: number;

  constructor(factory: ItemFactory<T>, size: number);
  constructor(factory: ItemFactory<T>, options: CollectionOptions);
  constructor(factory: ItemFactory<T>, sizeOrOptions: CollectionOptions | number) {
    const options = typeof sizeOrOptions === 'number' ? { size: sizeOrOptions } : sizeOrOptions;

    super(options.callable);
    this[$factory] = factory;
    this[$items] = new Array(options.size);
    this[$base] = options.base ?? 1;
    this[$pad] = options.pad;
  }

  get $size(): number {
    return this[$items].length;
  }

  $handleCall(peer?: unknown, ...args: OSCArgument[]): OSCArgument[] | undefined {
    if (!this.$callable || this.$getCallableProperties().length) {
      return super.$handleCall(peer, ...args);
    }

    const props = [...this[$items].keys()];
    const [results] = this.$applyToValues(props, args, (node, arg) => node.$handleCall(peer, arg));
    return results;
  }

  $get(prop: string): Node;
  $get(prop: number): T;
  $get(prop: string | number): any {
    if (typeof prop === 'string') {
      if (/^\d+$/.test(prop)) {
        prop = parseInt(prop.replace(/^0+(?!$)/, ''), 10) - this[$base];
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

  $set(prop: string, node: Node): void;
  $set(item: number, node: T): void;
  $set(prop: string | number, node: any): void {
    if (typeof prop === 'string') {
      if (/^\d+$/.test(prop)) {
        prop = parseInt(prop.replace(/^0+(?!$)/, '')) - this[$base];
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
      prop = parseInt(prop.replace(/^0+(?!$)/, '')) - this[$base];
    }

    return typeof prop === 'number' ? prop >= 0 && prop < this[$items].length : super.$has(prop);
  }

  $indexOf(node: Node): number {
    return this[$items].indexOf(node as T);
  }

  $attach(prop: string | number, value: Node) {
    if (typeof prop === 'number') {
      const idx = (prop + this[$base]).toString();
      prop = this[$pad] ? idx.padStart(this[$pad], '0') : idx;
    }

    super.$attach(prop, value);
  }

  * [Symbol.iterator](): IterableIterator<T> {
    yield * this.$items();
  }

  $items(lazy?: boolean, keys?: false): IterableIterator<T>;
  $items(lazy: boolean, keys: true): IterableIterator<[number, T]>;
  * $items(lazy: boolean = false, keys: boolean = false): IterableIterator<T | [number, T]> {
    for (let i = 0; i < this[$items].length; ++i) {
      if (!lazy || this[$items][i]) {
        yield keys ? [i, this.$get(i)] : this.$get(i);
      }
    }
  }

  $children(lazy?: boolean, keys?: false): IterableIterator<Node>;
  $children(lazy: boolean, keys: true): IterableIterator<[string | number, Node]>;
  * $children(lazy: boolean = false, keys: boolean = false): IterableIterator<Node | [string | number, Node]> {
    yield * super.$children(lazy, keys as any);
    yield * this.$items(lazy, keys as any);
  }
}
