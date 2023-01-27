import {
  OSCArgument,
  EventEmitter,
  EventHandler,
  EventMap,
} from '@mxfriend/osc';
import { Container } from './container';

export interface NodeEvents extends EventMap {
  attached: [parent: Container, address: string, node: Node];
  detached: [parent: Container, address: string, node: Node];
  destroy: [node: Node];
}

const $parent = Symbol('parent');
const $address = Symbol('address');
const $events = Symbol('events');

export abstract class Node<TEvents extends NodeEvents = NodeEvents> {
  private readonly [$events]: EventEmitter<TEvents> = new EventEmitter();
  private [$parent]?: Container;
  private [$address]: string = '';

  get $parent(): Container | undefined {
    return this[$parent];
  }

  get $address(): string {
    return this[$address];
  }

  $attached(parent: Container, address: string): void {
    this[$parent] = parent;
    this[$address] = address;
    this.$emit('attached', parent, address, this);
  }

  $detached(): void {
    const parent = this[$parent];
    const address = this[$address];
    this[$parent] = undefined;
    this[$address] = '';
    parent && this.$emit('detached', parent, address, this);
  }

  $destroy(): void {
    this.$emit('destroy', this);
    this.$off();
  }

  get $callable(): boolean {
    return false;
  }

  $handleCall(peer?: unknown, ...args: OSCArgument[]): OSCArgument[] | OSCArgument | undefined {
    throw new Error('Node is not callable');
  }

  $on<E extends string & keyof TEvents>(event: E, handler: EventHandler<TEvents, E>): void {
    this[$events].on(event, handler);
  }

  $once<E extends string & keyof TEvents>(event: E, handler: EventHandler<TEvents, E>): void {
    this[$events].once(event, handler);
  }

  $off<E extends string & keyof TEvents>(event?: E, handler?: EventHandler<TEvents, E>): void {
    this[$events].off(event, handler);
  }

  $emit<E extends string & keyof TEvents>(event: E, ...args: TEvents[E]): boolean {
    return this[$events].emit(event, ...args);
  }
}
