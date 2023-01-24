import { OSCArgument } from '@mxfriend/osc';
import { createProperty, getKnownProperties } from './decorators';
import { Node, NodeEvents } from './node';
import { pairs } from './utils';
import { Value } from './values';

export type ChildProp<C extends Container> = string & keyof {
  [P in keyof C as C[P] extends Node ? P : never]: C[P];
};

export type Child<C extends Container, P extends string = ChildProp<C>> =
  P extends ChildProp<C> ? C[P] extends Node ? C[P] : never : never;


export interface ContainerEvents extends NodeEvents {
  attach: [child: Node, container: Container];
  detach: [child: Node, container: Container];
}


const $callable = Symbol('callable');
const $data = Symbol('data');

export abstract class Container<
  TEvents extends ContainerEvents = ContainerEvents,
> extends Node<TEvents> {
  private readonly [$callable]: boolean;
  private readonly [$data]: Map<string | number, Node>;

  constructor(callable: boolean = false) {
    super();
    this[$callable] = callable;
    this[$data] = new Map();
  }

  get $callable(): boolean {
    return this[$callable];
  }

  $handleCall(peer?: unknown, ...args: OSCArgument[]): OSCArgument[] | undefined {
    if (!this[$callable]) {
      throw new Error('Node is not callable');
    }

    const props = this.$getCallableProperties();

    if (args.length) {
      for (let i = 0; i < args.length && i < props.length; ++i) {
        const node: any = this.$get(props[i]);

        if (node instanceof Value) {
          node.$handleCall(peer, args[i]);
        } else {
          break;
        }
      }

      return undefined;
    } else {
      const result: OSCArgument[] = [];

      for (const p of props) {
        const prop: any = this.$get(p);
        const r = prop instanceof Value && prop.$handleCall(peer);

        if (r) {
          result.push(r);
        } else {
          break;
        }
      }

      return result.length ? result : undefined;
    }
  }

  $get<P extends string>(prop: P): Child<this, P>;
  $get(prop: string | number): Node;
  $get(prop: string | number): Node {
    const existing = this[$data].get(prop);

    if (existing) {
      return existing;
    } else if (!this.$has(prop)) {
      throw new Error(`Unknown property: '${prop}'`);
    }

    const value = createProperty(this, prop.toString());
    this[$data].set(prop, value);
    this.$attach(prop, value);
    return value;
  }

  $set<P extends string>(prop: P, node: Child<this, P>): void;
  $set(prop: string | number, node: Node): void;
  $set(prop: string | number, node: Node): void {
    const existing = this[$data].get(prop);

    if (existing) {
      this.$detach(existing);
      existing.$destroy();
      this[$data].delete(prop);
    }

    this[$data].set(prop, node);
    this.$attach(prop, node);
  }

  $has(prop: string | number): boolean {
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

    for (const [prop, value] of this.$children(true, true)) {
      this.$attach(prop, value);
    }
  }

  $detached(): void {
    super.$detached();

    for (const child of this.$children(true)) {
      this.$detach(child);
    }
  }

  $destroy(): void {
    super.$destroy();

    for (const child of this.$children(true)) {
      child.$destroy();
    }
  }

  $merge(node: this): void {
    for (const [src, dst] of pairs(node.$children(), this.$children())) {
      if (src instanceof Container && dst instanceof Container) {
        dst.$merge(src);
      } else if (src instanceof Value && dst instanceof Value && src.$isSet()) {
        dst.$set(src.$get(), true);
      }
    }
  }

  $getKnownProperties(): (string | number)[] {
    return getKnownProperties(this);
  }

  protected $getCallableProperties(): (string | number)[] {
    return this.$getKnownProperties();
  }

  $attributes(lazy?: boolean, keys?: false): IterableIterator<Node>;
  $attributes(lazy: boolean, keys: true): IterableIterator<[string | number, Node]>;
  * $attributes(lazy: boolean = false, keys: boolean = false): IterableIterator<Node | [string | number, Node]> {
    for (const prop of this.$getKnownProperties()) {
      if (!lazy || this[$data].has(prop)) {
        yield keys ? [prop, this.$get(prop)] : this.$get(prop);
      }
    }
  }

  $children(lazy?: boolean, keys?: false): IterableIterator<Node>;
  $children(lazy: boolean, keys: true): IterableIterator<[string | number, Node]>;
  * $children(lazy: boolean = false, keys: boolean = false): IterableIterator<Node | [string | number, Node]> {
    yield * this.$attributes(lazy, keys as any);
  }
}
