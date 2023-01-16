import { OSCArgument } from '@mxfriend/osc';

type EventHandler = (...args: any[]) => void;

export type NodeEvents = {
  attached: (event: 'attached', node: Node, address: string) => void;
  detached: (event: 'detached', node: Node, address: string) => void;
};

const $address = Symbol('address');
const $events = Symbol('events');

export abstract class Node<TEvents extends NodeEvents = NodeEvents> {
  private [$address]: string = '';
  private readonly [$events]: Map<string, Set<EventHandler>> = new Map();

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

  get $callable(): boolean {
    return false;
  }

  $handleCall(...args: OSCArgument[]): OSCArgument[] | OSCArgument | undefined {
    throw new Error('Node is not callable');
  }

  $emit(event: string, ...args: any): void {
    const handlers = this[$events].get(event);

    if (handlers) {
      for (const handler of handlers) {
        handler(event, ...args);
      }
    }
  }

  $on<E extends keyof TEvents>(event: E, handler: TEvents[E]): void;
  $on(event: string, handler: EventHandler): void;
  $on(event: string, handler: EventHandler): void {
    this[$events].has(event) || this[$events].set(event, new Set());
    this[$events].get(event)!.add(handler);
  }

  $once<E extends keyof TEvents>(event: E, handler: TEvents[E]): void;
  $once(event: string, handler: EventHandler): void;
  $once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (...args) => {
      this.$off(event, wrapper);
      handler(...args);
    };

    this.$on(event, wrapper);
  }

  $off<E extends keyof TEvents>(event: E, handler?: TEvents[E]): void;
  $off(event?: string, handler?: EventHandler): void;
  $off(event?: string, handler?: EventHandler): void {
    if (!event) {
      this[$events].clear();
    } else if (!handler) {
      this[$events].get(event)?.clear();
    } else {
      this[$events].get(event)?.delete(handler);
    }
  }
}
