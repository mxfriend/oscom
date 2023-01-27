import {
  AbstractOSCPort,
  AnyEventHandler,
  EventEmitter,
  EventMap,
  OSCArgument,
  OSCMessage,
} from '@mxfriend/osc';
import { Command } from './command';
import { Container } from './container';
import { Node } from './node';
import { Value } from './values';

type NodeListeners = {
  handleCall: (message: OSCMessage, peer?: unknown) => void;
  handleAttached: (address: string) => void;
  handleDetached: (address: string) => void;
  map: NodeListenerMap;
};

export type NodeListenerMap = Set<[string, AnyEventHandler]>;

type QueryNodes<T extends [...any]> = { [i in keyof T]: Value<T[i]> };
type QueryResult<T extends [...any]> = Promise<{ [i in keyof T]: T[i] | undefined }>;

export interface DispatcherEvents extends EventMap {
  monitor: [node: Node];
  unmonitor: [node: Node];
}

export class Dispatcher<
  TEvents extends DispatcherEvents = DispatcherEvents,
> extends EventEmitter<TEvents> {
  protected readonly port: AbstractOSCPort;
  private readonly listeners: Map<Node, NodeListeners> = new Map();

  constructor(port: AbstractOSCPort) {
    super();
    this.port = port;
  }

  public async addAndQuery<T>(node: Value<T>): Promise<T>;
  public async addAndQuery<T extends [any, any, ...any]>(...nodes: QueryNodes<T>): QueryResult<T>;
  public async addAndQuery(...nodes: Value[]): Promise<any[]>;
  public async addAndQuery(...nodes: Value[]): Promise<any | any[]> {
    this.add(...nodes);
    return this.query(...nodes);
  }

  public add(...nodes: Node[]): void {
    for (const node of nodes) {
      if (node.$callable) {
        this.monitor(node);
      }

      if (node instanceof Container) {
        for (const child of node.$children()) {
          this.add(child);
        }
      }
    }
  }

  public remove(...nodes: Node[]): void {
    for (const node of nodes) {
      if (node.$callable) {
        this.unmonitor(node);
      }

      if (node instanceof Container) {
        for (const child of node.$children(true)) {
          this.remove(child);
        }
      }
    }
  }

  async query<T>(node: Value<T>): Promise<T | undefined>;
  async query<T extends [any, any, ...any]>(...nodes: QueryNodes<T>): QueryResult<T>;
  async query(...nodes: Value[]): Promise<any[]>;
  async query(...nodes: Value[]): Promise<any | any[]> {
    const result = await Promise.all(nodes.map((node) => this.queryNode(node)));
    return result.length > 1 ? result : result[0];
  }

  private async queryNode<T>(node: Value<T>, timeout?: number): Promise<T | undefined> {
    return new Promise(async (resolve, reject) => {
      let to: NodeJS.Timeout;
      let qi: NodeJS.Timeout;

      const done = (message: OSCMessage, peer?: unknown) => {
        cleanup();

        if (!this.listeners.has(node)) {
          node.$handleCall(peer, ...message.args);
        }

        resolve(node.$get());
      };

      const abort = () => {
        cleanup();
        reject(new Error('Timeout'));
      };

      const cleanup = () => {
        this.port.unsubscribe(node.$address, done);
        to && clearTimeout(to);
        qi && clearInterval(qi);
      };

      this.port.subscribe(node.$address, done);
      await this.port.send(node.$address);
      qi = setInterval(async () => this.port.send(node.$address), 500);
      timeout && (to = setTimeout(abort, timeout));
    });
  }

  private monitor(node: Node): void {
    if (this.listeners.has(node)) {
      return;
    }

    const listeners: NodeListeners = {
      handleCall: async (message, peer) => {
        const response = node.$handleCall(peer, ...message.args);

        if (response) {
          await this.port.send(node.$address, Array.isArray(response) ? response : [response], peer);
        }
      },
      handleAttached: (address) => {
        this.port.subscribe(address, listeners.handleCall);

        for (const [event, handler] of listeners.map) {
          node.$on(event, handler);
        }
      },
      handleDetached: (address) => {
        this.port.unsubscribe(address, listeners.handleCall);

        for (const [event, handler] of listeners.map) {
          node.$off(event, handler);
        }
      },
      map: new Set(this.createNodeListeners(node)),
    };

    if (node.$address) {
      listeners.handleAttached(node.$address);
    }

    node.$on('attached', listeners.handleAttached);
    node.$on('detached', listeners.handleDetached);

    node.$on('destroy', () => {
      this.unmonitor(node);
    });

    this.listeners.set(node, listeners);
    this.emit('monitor', node);
  }

  private unmonitor(node: Node): void {
    const listeners = this.listeners.get(node);

    if (!listeners) {
      return;
    }

    node.$off('attached', listeners.handleAttached);
    node.$off('detached', listeners.handleDetached);
    this.listeners.delete(node);

    if (node.$address) {
      listeners.handleDetached(node.$address);
    }

    this.emit('unmonitor', node);
  }

  protected * createNodeListeners(node: Node): IterableIterator<[string, AnyEventHandler]> {
    if (node instanceof Value) {
      yield ['local-change', async () => {
        const value = node.$toOSC();
        value && node.$address && await this.port.send(node.$address, [value]);
      }];
    } else if (node instanceof Command) {
      yield ['local-call', async (args?: OSCArgument[]) => {
        node.$address && await this.port.send(node.$address, args);
      }];
    }
  }
}
