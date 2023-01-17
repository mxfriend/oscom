import { AbstractOSCPort, OSCArgument, OSCMessage } from '@mxfriend/osc';
import { Command } from './command';
import { Container } from './container';
import { Node } from './node';
import { Value } from './values';

type NodeListeners<TPeer = unknown, TValue = any> = {
  handleCall: (message: OSCMessage, peer?: TPeer) => void;
  handleLocalChange?: (event: 'local-change', node: Value<TValue>, value: TValue) => void;
  handleLocalCall?: (event: 'local-call', node: Command, args?: OSCArgument[]) => void;
  handleAttached: (event: 'attached', node: Node, address: string) => void;
  handleDetached: (event: 'detached', node: Node, address: string) => void;
};

export class Dispatcher<TPeer = unknown> {
  private readonly port: AbstractOSCPort<TPeer>;
  private readonly listeners: Map<Node, NodeListeners<TPeer>> = new Map();

  constructor(port: AbstractOSCPort<TPeer>) {
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
    const listeners: NodeListeners<TPeer> = {
      handleCall: async (message, peer) => {
        const response = node.$handleCall(...message.args);

        if (response) {
          await this.port.send(node.$address, Array.isArray(response) ? response : [response], peer);
        }
      },
      handleAttached: (_, node, address) => {
        this.port.subscribe(address, listeners.handleCall);

        if (node instanceof Value) {
          node.$on('local-change', listeners.handleLocalChange!);
        } else if (node instanceof Command) {
          node.$on('local-call', listeners.handleLocalCall!);
        }
      },
      handleDetached: (_, node, address) => {
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
        listeners.handleLocalCall = async (_, node, args) => {
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
      this.port.unsubscribe(node.$address, listeners.handleCall);

      if (node instanceof Value) {
        node.$off('local-change', listeners.handleLocalChange);
      } else if (node instanceof Command) {
        node.$off('local-call', listeners.handleLocalCall);
      }
    }
  }
}
