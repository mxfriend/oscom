import { AbstractOSCPort, OSCArgument, OSCMessage } from '@mxfriend/osc';
import { Command } from './command';
import { Container } from './container';
import { Node } from './node';
import { Value } from './values';

type NodeListeners = {
  handleCall: (message: OSCMessage, peer?: unknown) => void;
  handleLocalChange?: (value: unknown, node: Value<unknown>) => void;
  handleLocalCall?: (args: OSCArgument[]) => void;
  handleAttached: (address: string) => void;
  handleDetached: (address: string) => void;
};

export class Dispatcher {
  private readonly port: AbstractOSCPort;
  private readonly listeners: Map<Node, NodeListeners> = new Map();

  constructor(port: AbstractOSCPort) {
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

  private monitor(node: Node): void {
    const listeners: NodeListeners = {
      handleCall: async (message, peer) => {
        const response = node.$handleCall(...message.args);

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
  }
}
