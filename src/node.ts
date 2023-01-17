import { OSCArgument, EventEmitter, EventMap } from '@mxfriend/osc';

type EventHandler = (...args: any[]) => void;

export type NodeEvents = {
  attached: (event: 'attached', node: Node, address: string) => void;
  detached: (event: 'detached', node: Node, address: string) => void;
  destroy: (event: 'destroy', node: Node) => void;
};

const $address = Symbol('address');
const $events = Symbol('events');

export abstract class Node<TEvents extends EventMap = NodeEvents> {
  private [$address]: string = '';
  private readonly [$events]: EventEmitter<TEvents> = new EventEmitter();

  get $address(): string {
    return this[$address];
  }

  $attached(address: string): void {
    this[$address] = address;
    this.$emit('attached', this, address);
  }

  $detached(): void {
    const address = this[$address];
    this[$address] = '';
    this.$emit('detached', this, address);
  }

  $destroy(): void {
    this.$emit('destroy', this);
    this.$off();
  }

  get $callable(): boolean {
    return false;
  }

  $handleCall(...args: OSCArgument[]): OSCArgument[] | OSCArgument | undefined {
    throw new Error('Node is not callable');
  }

  $on<E extends keyof TEvents>(event: E, handler: TEvents[E]): void;
  $on(event: string, handler: EventHandler): void;
  $on(event: string, handler: EventHandler): void {
    this[$events].on(event, handler);
  }

  $once<E extends keyof TEvents>(event: E, handler: TEvents[E]): void;
  $once(event: string, handler: EventHandler): void;
  $once(event: string, handler: EventHandler): void {
    this[$events].once(event, handler);
  }

  $off<E extends keyof TEvents>(event: E, handler?: TEvents[E]): void;
  $off(event?: string, handler?: EventHandler): void;
  $off(event?: string, handler?: EventHandler): void {
    this[$events].off(event, handler);
  }

  $emit(event: string, ...args: any): boolean {
    return this[$events].emit(event, ...args);
  }
}
