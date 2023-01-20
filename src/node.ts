import {
  OSCArgument,
  EventEmitter,
  EventMapExtension,
  MergeEventMap,
  EventHandler,
} from '@mxfriend/osc';

export type NodeEvents = {
  attached: [address: string, node: Node];
  detached: [address: string, node: Node];
  destroy: [node: Node];
};

const $address = Symbol('address');
const $events = Symbol('events');

export abstract class Node<TEvents extends EventMapExtension<NodeEvents> = {}> {
  private [$address]: string = '';
  private readonly [$events]: EventEmitter<MergeEventMap<NodeEvents, TEvents>> = new EventEmitter();

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

  $handleCall(args?: OSCArgument[], peer?: unknown): OSCArgument[] | OSCArgument | undefined {
    throw new Error('Node is not callable');
  }

  $on<E extends string & keyof MergeEventMap<NodeEvents, TEvents>>(
    event: E,
    handler: EventHandler<MergeEventMap<NodeEvents, TEvents>, E>,
  ): void {
    this[$events].on(event, handler);
  }

  $once<E extends string & keyof MergeEventMap<NodeEvents, TEvents>>(
    event: E,
    handler: EventHandler<MergeEventMap<NodeEvents, TEvents>, E>,
  ): void {
    this[$events].once(event, handler);
  }

  $off<E extends string & keyof MergeEventMap<NodeEvents, TEvents>>(
    event?: E,
    handler?: EventHandler<MergeEventMap<NodeEvents, TEvents>, E>,
  ): void {
    this[$events].off(event, handler);
  }

  $emit<E extends string & keyof MergeEventMap<NodeEvents, TEvents>>(
    event: E,
    ...args: MergeEventMap<NodeEvents, TEvents>[E]
  ): boolean {
    return this[$events].emit(event, ...args);
  }
}
