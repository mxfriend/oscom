import { OSCArgument } from '@mxfriend/osc';
import { Node } from './node';

export type CommandEvents = {
  'local-call': (args: OSCArgument[], node: Command) => void;
  'remote-call': (args: OSCArgument[], node: Command) => void;
};

export abstract class Command extends Node<CommandEvents> {
  public abstract $call(...args: any): void;

  public $handleCall(...args: OSCArgument[]): undefined {
    this.$emit('remote-call', args, this);
    return undefined;
  }
}
