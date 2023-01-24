import {
  OSCArgument,
  EventEmitter,
  EventHandler,
  EventMap,
} from '@mxfriend/osc';

export interface NodeEvents extends EventMap {
  attached: [address: string, node: Node];
  detached: [address: string, node: Node];
  destroy: [node: Node];
}

const $address = Symbol('address');
const $events = Symbol('events');

export abstract class Node<TEvents extends NodeEvents = NodeEvents> {
  private readonly [$events]: EventEmitter<TEvents> = new EventEmitter();
  private [$address]: string = '';

  get $address(): string {
    return this[$address];
  }

  $attached(address: string): void {
    this[$address] = address;
    this.$emit('attached', address, this);
  }

  $detached(): void {
    const address = this[$address];
    this[$address] = '';
    this.$emit('detached', address, this);
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
