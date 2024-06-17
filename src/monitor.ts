import {
  AbstractOSCPort,
  AnyEventHandler,
  EventEmitter,
  EventMap,
  OSCMessage,
} from '@mxfriend/osc';
import { Container } from './container';
import { Dispatcher } from './dispatcher';
import { Node } from './node';

export interface MonitorEvents extends EventMap {
  destroyed: [node: Node];
}

export type NodeListenerMap = Set<[event: string, handler: AnyEventHandler]>;

export class Monitor extends EventEmitter<MonitorEvents> {
  private readonly dispatcher: Dispatcher;
  private readonly port: AbstractOSCPort;
  private readonly node: Node;
  private readonly keys: Set<symbol> = new Set();
  private readonly listeners: NodeListenerMap;

  constructor(
    dispatcher: Dispatcher,
    port: AbstractOSCPort,
    node: Node,
    listeners: NodeListenerMap,
  ) {
    super();
    this.dispatcher = dispatcher;
    this.port = port;
    this.node = node;
    this.listeners = listeners;

    this.handleAttached = this.handleAttached.bind(this);
    this.handleDetached = this.handleDetached.bind(this);
    this.handleAttach = this.handleAttach.bind(this);
    this.handleCall = this.handleCall.bind(this);
  }

  public init(): void {
    if (this.node.$parent) {
      this.handleAttached(this.node.$parent, this.node.$address);
    }

    this.node.$on('attached', this.handleAttached);
    this.node.$on('detached', this.handleDetached);

    if (this.node instanceof Container) {
      this.node.$on('attach', this.handleAttach);
    }

    this.node.$on('destroy', () => {
      this.emit('destroyed', this.node);
    });
  }

  public monitor(key: symbol): void {
    this.keys.add(key);
  }

  public unmonitor(key?: symbol): boolean {
    if (key === undefined) {
      this.keys.clear();
    } else {
      this.keys.delete(key);
    }

    if (this.keys.size > 0) {
      return false;
    }

    this.node.$off('attached', this.handleAttached);
    this.node.$off('detached', this.handleDetached);

    if (this.node instanceof Container) {
      this.node.$off('attach', this.handleAttach);
    }

    if (this.node.$parent) {
      this.handleDetached(this.node.$parent, this.node.$address);
    }

    return true;
  }

  protected handleAttached(parent: Container, address: string): void {
    if (this.node.$callable) {
      this.port.subscribe(address, this.handleCall);
    }

    for (const [event, handler] of this.listeners) {
      this.node.$on(event, handler);
    }
  }

  protected handleDetached(parent: Container, address: string): void {
    if (this.node.$callable) {
      this.port.unsubscribe(address, this.handleCall);
    }

    for (const [event, handler] of this.listeners) {
      this.node.$off(event, handler);
    }
  }

  protected async handleAttach(child: Node): Promise<void> {
    for (const key of this.keys) {
      this.dispatcher.add(key, child);
    }
  }

  protected async handleCall(message: OSCMessage, peer?: unknown): Promise<void> {
    const response = this.node.$handleCall(peer, ...message.args);

    if (response) {
      await this.port.send(this.node.$address, Array.isArray(response) ? response : [response], peer);
    }
  }
}
