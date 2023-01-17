import { OSCArgument } from '@mxfriend/osc';
import { Node, NodeEvents } from './node';

export type CommandEvents = NodeEvents & {
  'local-call': (evt: 'local-call', node: Command, args?: OSCArgument[]) => void;
  'remote-call': (evt: 'remote-call', node: Command, args?: OSCArgument[]) => void;
};

export abstract class Command extends Node<CommandEvents> {
  public abstract $call(...args: any): void;

  public $handleCall(...args: OSCArgument[]): undefined {
    this.$emit('remote-call', this, args);
    return undefined;
  }
}
