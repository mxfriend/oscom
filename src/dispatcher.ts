import { AbstractOSCPort, EventEmitter, OSCArgument, OSCMessage } from '@mxfriend/osc';
import { Command } from './command';
import { Container } from './container';
import { Node } from './node';
import { Value } from './values';

type NodeListeners = {
  handleCall: (message: OSCMessage, peer?: unknown) => void;
  handleLocalChange?: (value: unknown, node: Value<unknown>) => void;
  handleLocalCall?: (args?: OSCArgument[]) => void;
  handleAttached: (address: string) => void;
  handleDetached: (address: string) => void;
};

export type DispatcherEvents = {
  monitor: [node: Node];
  unmonitor: [node: Node];
};

export class Dispatcher extends EventEmitter<DispatcherEvents> {
  protected readonly port: AbstractOSCPort;
  private readonly listeners: Map<Node, NodeListeners> = new Map();

  constructor(port: AbstractOSCPort) {
    super();
    this.port = port;
  }

  public add(node: Node): void {
    if (node.$callable) {
      this.monitor(node);
    }

    if (node instanceof Container) {
      for (const child of node) {
        this.add(child);
      }
    }
  }

  public remove(node: Node): void {
    if (node.$callable) {
      this.unmonitor(node);
    }

    if (node instanceof Container) {
      for (const child of node) {
        this.remove(child);
      }
    }
  }

  async query<T>(node: Value<T>, timeout?: number): Promise<T | undefined> {
    return new Promise(async (resolve, reject) => {
      let to: NodeJS.Timeout;
      let qi: NodeJS.Timeout;

      const done = (message: OSCMessage, peer?: unknown) => {
        cleanup();

        if (!this.listeners.has(node)) {
          node.$handleCall(message.args, peer);
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
      qi = setInterval(async () => this.port.send(node.$address), 2000);
      timeout && (to = setTimeout(abort, timeout));
    });
  }

  private monitor(node: Node): void {
    if (this.listeners.has(node)) {
      return;
    }

    const listeners: NodeListeners = {
      handleCall: async (message, peer) => {
        const response = node.$handleCall(message.args, peer);

        if (response) {
          await this.port.send(node.$address, Array.isArray(response) ? response : [response], peer);
        }
      },
      handleAttached: (address) => {
        this.port.subscribe(address, listeners.handleCall);

        if (node instanceof Value) {
          node.$on('local-change', listeners.handleLocalChange!);
        } else if (node instanceof Command) {
          node.$on('local-call', listeners.handleLocalCall!);
        }
      },
      handleDetached: (address) => {
        this.port.unsubscribe(address, listeners.handleCall);

        if (node instanceof Value) {
          node.$off('local-change', listeners.handleLocalChange);
        } else if (node instanceof Command) {
          node.$off('local-call', listeners.handleLocalCall);
        }
      },
    };

    if (node.$address) {
      this.port.subscribe(node.$address, listeners.handleCall);

      if (node instanceof Value) {
        listeners.handleLocalChange = async (_, node) => {
          const value = node.$toOSC();
          value && node.$address && await this.port.send(node.$address, [value]);
        };

        node.$on('local-change', listeners.handleLocalChange);
      } else if (node instanceof Command) {
        listeners.handleLocalCall = async (args) => {
          node.$address && await this.port.send(node.$address, args);
        };

        node.$on('local-call', listeners.handleLocalCall);
      }
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
}
