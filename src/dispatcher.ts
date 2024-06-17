import {
  AbstractOSCPort,
  AnyEventHandler,
  EventEmitter,
  EventMap,
  OSCArgument,
  osc,
} from '@mxfriend/osc';
import { Collection } from './collection';
import { Command } from './command';
import { Container } from './container';
import { Monitor } from './monitor';
import { Node } from './node';
import { Value } from './values';

type QueryNodes = [Value, Value, ...Value[]];
type QueryResult<Nodes extends [...Value[]]> = {
  [i in keyof Nodes]: Nodes[i] extends Value<infer T> ? T | undefined : never;
};

export interface DispatcherEvents extends EventMap {
  monitor: [node: Node];
  unmonitor: [node: Node];
}

export class Dispatcher<
  TEvents extends DispatcherEvents = DispatcherEvents,
> extends EventEmitter<TEvents> {
  protected readonly port: AbstractOSCPort;
  private readonly nodes: Map<Node, Monitor> = new Map();

  constructor(port: AbstractOSCPort) {
    super();
    this.port = port;
  }

  public add(key: symbol, ...nodes: Node[]): void {
    for (const node of nodes) {
      this.monitor(node, key);

      if (node instanceof Container) {
        for (const child of node.$children()) {
          this.add(key, child);
        }
      }
    }
  }

  public remove(key: symbol, ...nodes: Node[]): void {
    for (const node of nodes) {
      if (node instanceof Container) {
        for (const child of node.$children(true)) {
          this.remove(key, child);
        }
      }

      this.unmonitor(node, key);
    }
  }

  public has(node: Node): boolean {
    return this.nodes.has(node);
  }

  public async query<T>(node: Value<T>): Promise<T | undefined>;
  public async query<Nodes extends QueryNodes>(...nodes: Nodes): Promise<QueryResult<Nodes>>;
  public async query(...nodes: Value[]): Promise<any[]>;
  public async query(...nodes: Value[]): Promise<any | any[]> {
    const result = await Promise.all(nodes.map(async (node) => this.queryValue(node)));
    return result.length > 1 ? result : result[0];
  }

  public async queryRecursive(...nodes: Node[]): Promise<void> {
    for (const node of nodes) {
      if (node instanceof Container) {
        await this.queryRecursive(...await this.queryContainer(node));
      } else if (node instanceof Value) {
        await this.queryValue(node);
      }
    }
  }

  protected async queryContainer(container: Container, timeout?: number): Promise<Iterable<Node>> {
    if (!container.$callable) {
      return container.$children();
    }

    const [args, peer] = await osc.query(this.port, {
      address: container.$address,
      timeout,
    });

    if (!this.nodes.has(container)) {
      container.$handleCall(peer, ...args);
    }

    const knownProps = container.$getKnownProperties();
    const callableProps = container.$getCallableProperties();
    const unusedProps = knownProps.filter((prop) => !callableProps.includes(prop));

    if (container instanceof Collection && !callableProps.length) {
      unusedProps.push(...new Array(container.$size).keys());
    }

    return unusedProps.map((prop) => container.$get(prop));
  }

  protected async queryValue<T>(node: Value<T>, timeout?: number): Promise<T | undefined> {
    const [args, peer] = await osc.query(this.port, {
      address: node.$address,
      timeout,
    });

    if (!this.nodes.has(node)) {
      node.$handleCall(peer, ...args);
    }

    return node.$get();
  }

  protected monitor(node: Node, key: symbol): void {
    const existing = this.nodes.get(node);

    if (existing) {
      existing.monitor(key);
      return;
    }

    const monitor = this.createMonitor(node);
    monitor.monitor(key);
    this.nodes.set(node, monitor);

    monitor.init();

    monitor.on('destroyed', () => {
      this.unmonitor(node);
    });

    this.emit('monitor', node);
  }

  protected unmonitor(node: Node, key?: symbol): void {
    const monitor = this.nodes.get(node);

    if (!monitor || !monitor.unmonitor(key)) {
      return;
    }

    this.nodes.delete(node);
    this.emit('unmonitor', node);
  }

  protected createMonitor(node: Node): Monitor {
    return new Monitor(this, this.port, node, new Set(this.createNodeListeners(node)));
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
