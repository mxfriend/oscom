import { OSCArgument } from '@mxfriend/osc';
import { inspect } from 'util';
import { createProperty, getKnownProperties } from './decorators';
import { Node, NodeEvents } from './node';
import { Value } from './values';

export type ChildContainers<C extends Container> = keyof C & keyof {
  [P in keyof C as C[P] extends Container ? P : never]: C[P];
};

export type ChildValues<C extends Container> = keyof C & keyof {
  [P in keyof C as C[P] extends Value ? P : never]: C[P];
};

export type Children<C extends Container> = ChildContainers<C> | ChildValues<C>;

export type Child<C extends Container, P extends string> = P extends Children<C> ? C[P] : any;

export type ContainerEvents = NodeEvents & {
  attach: (event: 'attach', node: Container, child: Container | Value) => void;
  detach: (event: 'detach', node: Container, child: Container | Value) => void;
};

const $callable = Symbol('callable');
const $data = Symbol('data');

export abstract class Container extends Node<ContainerEvents> {
  private readonly [$callable]: boolean;
  private readonly [$data]: Map<string, Container | Value>;

  constructor(callable: boolean = false) {
    super();
    this[$callable] = callable;
    this[$data] = new Map();
  }

  get $callable(): boolean {
    return this[$callable];
  }

  $handleCall(...args: OSCArgument[]): OSCArgument[] | undefined {
    if (!this[$callable]) {
      throw new Error('Node is not callable');
    }

    const props = this.$getKnownProperties();

    if (args.length) {
      for (let i = 0; i < args.length && i < props.length; ++i) {
        const node: any = this.$get(props[i]);

        if (node instanceof Value) {
          node.$handleCall(args[i]);
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
  $get(prop: string): any {
    const existing = this[$data].get(prop);

    if (existing) {
      return existing;
    }

    const value = createProperty(this, prop);
    this[$data].set(prop, value);
    this.$attach(prop, value);
    return value;
  }

  $set<P extends string>(prop: P, node: Child<this, P>): void;
  $set(prop: string, node: any): void {
    const existing = this[$data].get(prop);

    if (existing) {
      this.$emit('detach', this, existing);
      existing.$destroy();
      this[$data].delete(prop);
    }

    this[$data].set(prop, node);
    this.$attach(prop, node);
  }

  protected $attach(prop: string | number, node: Container | Value): void {
    node.$attached(`${this.$address}/${prop}`);
    this.$emit('attach', this, node);
  }

  protected $detach(node: Container | Value): void {
    node.$detached();
    this.$emit('detach', this, node);
  }

  $attached(address: string): void {
    super.$attached(address);

    for (const [prop, value] of this.$entries()) {
      this.$attach(prop, value);
    }
  }

  $detached(): void {
    super.$detached();

    for (const [prop, value] of this.$entries()) {
      this.$attach(prop, value);
    }
  }

  $destroy(): void {
    super.$destroy();

    for (const value of this) {
      value.$destroy();
    }
  }

  $merge(node: this): void {
    for (const [prop, value] of node.$entries()) {
      const dst = this.$get(prop as any) as any;

      if (value instanceof Container) {
        dst.$merge(value);
      } else {
        dst.$set(value.$get());
      }
    }
  }

  $getKnownProperties(): any[] {
    return getKnownProperties(this);
  }

  [Symbol.iterator](): IterableIterator<Container | Value> {
    return this.$values();
  }

  * $entries(): IterableIterator<[string | number, Container | Value]> {
    for (const prop of this.$getKnownProperties()) {
      yield [prop, this.$get(prop)];
    }
  }

  * $values(): IterableIterator<Container | Value> {
    for (const prop of this.$getKnownProperties()) {
      yield this.$get(prop);
    }
  }

  [inspect.custom]() {
    return Object.fromEntries(this.$entries());
  }
}
