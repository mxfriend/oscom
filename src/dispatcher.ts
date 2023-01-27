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

type NodeData = {
  keys: Set<symbol>;
  handleCall: (message: OSCMessage, peer?: unknown) => void;
  handleAttached: (parent: Container, address: string) => void;
  handleDetached: (parent: Container, address: string) => void;
  listeners: NodeListenerMap;
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
  private readonly nodes: Map<Node, NodeData> = new Map();

  constructor(port: AbstractOSCPort) {
    super();
    this.port = port;
  }

  public async addAndQuery<T>(key: symbol, node: Value<T>): Promise<T>;
  public async addAndQuery<T extends [any, any, ...any]>(key: symbol, ...nodes: QueryNodes<T>): QueryResult<T>;
  public async addAndQuery(key: symbol, ...nodes: Value[]): Promise<any[]>;
  public async addAndQuery(key: symbol, ...nodes: Value[]): Promise<any | any[]> {
    this.add(key, ...nodes);
    return this.query(...nodes);
  }

  public add(key: symbol, ...nodes: Node[]): void {
    for (const node of nodes) {
      if (node.$callable) {
        this.monitor(node, key);
      }

      if (node instanceof Container) {
        for (const child of node.$children()) {
          this.add(key, child);
        }
      }
    }
  }

  public remove(key: symbol, ...nodes: Node[]): void {
    for (const node of nodes) {
      if (node.$callable) {
        this.unmonitor(node, key);
      }

      if (node instanceof Container) {
        for (const child of node.$children(true)) {
          this.remove(key, child);
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

        if (!this.nodes.has(node)) {
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

  private monitor(node: Node, key: symbol): void {
    const existing = this.nodes.get(node);

    if (existing) {
      existing.keys.add(key);
      return;
    }

    const data: NodeData = {
      keys: new Set([key]),
      handleCall: async (message, peer) => {
        const response = node.$handleCall(peer, ...message.args);

        if (response) {
          await this.port.send(node.$address, Array.isArray(response) ? response : [response], peer);
        }
      },
      handleAttached: (parent, address) => {
        this.port.subscribe(address, data.handleCall);

        for (const [event, handler] of data.listeners) {
          node.$on(event, handler);
        }
      },
      handleDetached: (parent, address) => {
        this.port.unsubscribe(address, data.handleCall);

        for (const [event, handler] of data.listeners) {
          node.$off(event, handler);
        }
      },
      listeners: new Set(this.createNodeListeners(node)),
    };

    if (node.$parent) {
      data.handleAttached(node.$parent, node.$address);
    }

    node.$on('attached', data.handleAttached);
    node.$on('detached', data.handleDetached);

    node.$on('destroy', () => {
      this.unmonitor(node);
    });

    this.nodes.set(node, data);
    this.emit('monitor', node);
  }

  private unmonitor(node: Node, key?: symbol): void {
    const data = this.nodes.get(node);

    if (!data) {
      return;
    }

    if (key !== undefined) {
      data.keys.delete(key);

      if (data.keys.size) {
        return;
      }
    }

    node.$off('attached', data.handleAttached);
    node.$off('detached', data.handleDetached);
    this.nodes.delete(node);

    if (node.$parent) {
      data.handleDetached(node.$parent, node.$address);
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
