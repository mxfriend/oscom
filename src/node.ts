import { OSCArgument, EventEmitter, EventMap, MergeEventMap } from '@mxfriend/osc';

export type NodeEvents = {
  attached: (address: string, node: Node) => void;
  detached: (address: string, node: Node) => void;
  destroy: (node: Node) => void;
};

const $address = Symbol('address');
const $events = Symbol('events');

export abstract class Node<TEvents extends EventMap = {}> {
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

  $on<E extends keyof TEvents>(event: E, handler: TEvents[E]): void;
  $on<E extends keyof NodeEvents>(event: E, handler: NodeEvents[E]): void;
  $on(event: any, handler: any): void {
    this[$events].on(event, handler);
  }

  $once<E extends keyof TEvents>(event: E, handler: TEvents[E]): void;
  $once<E extends keyof NodeEvents>(event: E, handler: NodeEvents[E]): void;
  $once(event: any, handler: any): void {
    this[$events].once(event, handler);
  }

  $off<E extends keyof TEvents>(event: E, handler?: TEvents[E]): void;
  $off<E extends keyof NodeEvents>(event?: E, handler?: NodeEvents[E]): void;
  $off(event?: any, handler?: any): void {
    this[$events].off(event, handler);
  }

  $emit<E extends keyof TEvents>(event: E, ...args: Parameters<TEvents[E]>): void;
  $emit<E extends keyof NodeEvents>(event: E, ...args: Parameters<NodeEvents[E]>): void;
  $emit(event: any, ...args: any): boolean {
    return this[$events].emit(event, ...args);
  }
}
