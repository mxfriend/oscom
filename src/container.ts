import { OSCArgument } from '@mxfriend/osc';
import { inspect } from 'util';
import { createProperty, getKnownProperties } from './decorators';
import { Node } from './node';
import { Value } from './values';

export type Children<C extends Container> = keyof C & keyof {
  [P in keyof C as C[P] extends Node ? P : never]: C[P];
};

export type Child<C extends Container, P extends string> = P extends Children<C> ? C[P] : any;

export type ContainerEvents = {
  attach: (child: Node, container: Container) => void;
  detach: (child: Node, container: Container) => void;
  'remote-call': (args: OSCArgument[] | undefined, node: Container, peer?: unknown) => void;
};

const $callable = Symbol('callable');
const $data = Symbol('data');

export abstract class Container extends Node<ContainerEvents> {
  private readonly [$callable]: boolean;
  private readonly [$data]: Map<string, Node>;

  constructor(callable: boolean = false) {
    super();
    this[$callable] = callable;
    this[$data] = new Map();
  }

  get $callable(): boolean {
    return this[$callable];
  }

  $handleCall(args: OSCArgument[], peer?: unknown): OSCArgument[] | undefined {
    if (!this[$callable]) {
      throw new Error('Node is not callable');
    }

    const props = this.$getKnownProperties();

    if (args.length) {
      for (let i = 0; i < args.length && i < props.length; ++i) {
        const node: any = this.$get(props[i]);

        if (node instanceof Value) {
          node.$handleCall([args[i]], peer);
        } else {
          break;
        }
      }

      return undefined;
    } else {
      const result: OSCArgument[] = [];

      for (const p of props) {
        const prop: any = this.$get(p);
        const r = prop instanceof Value && prop.$handleCall();

        if (r) {
          result.push(r);
        } else {
          break;
        }
      }

      return result;
    }
  }

  $get<P extends string>(prop: P): Child<this, P>;
  $get(prop: string): Node {
    const existing = this[$data].get(prop);

    if (existing) {
      return existing;
    } else if (!this.$has(prop)) {
      throw new Error(`Unknown property: '${prop}'`);
    }

    const value = createProperty(this, prop);
    this[$data].set(prop, value);
    this.$attach(prop, value);
    return value;
  }

  $set<P extends string>(prop: P, node: Child<this, P>): void;
  $set(prop: string, node: Node): void {
    const existing = this[$data].get(prop);

    if (existing) {
      this.$detach(existing);
      existing.$destroy();
      this[$data].delete(prop);
    }

    this[$data].set(prop, node);
    this.$attach(prop, node);
  }

  $has(prop: string): boolean {
    return this.$getKnownProperties().includes(prop);
  }

  protected $attach(prop: string | number, node: Node): void {
    node.$attached(`${this.$address}/${prop}`);
    this.$emit('attach', node, this);
  }

  protected $detach(node: Node): void {
    node.$detached();
    this.$emit('detach', node, this);
  }

  $attached(address: string): void {
    super.$attached(address);

    for (const [prop, value] of this.$entries(true)) {
      this.$attach(prop, value);
    }
  }

  $detached(): void {
    super.$detached();

    for (const [, value] of this.$entries(true)) {
      this.$detach(value);
    }
  }

  $destroy(): void {
    super.$destroy();

    for (const [, value] of this.$entries(true)) {
      value.$destroy();
    }
  }

  $merge(node: this): void {
    for (const [prop, value] of node.$entries(true)) {
      const dst = this.$get(prop as any) as any;

      if (value instanceof Container) {
        dst.$merge(value);
      } else if (value instanceof Value) {
        dst.$set(value.$get());
      }
    }
  }

  $getKnownProperties(): any[] {
    return getKnownProperties(this);
  }

  [Symbol.iterator](): IterableIterator<Node> {
    return this.$values();
  }

  * $entries(lazy: boolean = false): IterableIterator<[string | number, Node]> {
    for (const prop of this.$getKnownProperties()) {
      if (!lazy || this[$data].has(prop)) {
        yield [prop, this.$get(prop)];
      }
    }
  }

  * $values(): IterableIterator<Node> {
    for (const prop of this.$getKnownProperties()) {
      yield this.$get(prop);
    }
  }

  [inspect.custom]() {
    return Object.fromEntries(this.$entries());
  }
}
