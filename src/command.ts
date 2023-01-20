import { OSCArgument } from '@mxfriend/osc';
import { Node } from './node';

export type CommandEvents = {
  'local-call': (args: OSCArgument[] | undefined, node: Command) => void;
  'remote-call': (args: OSCArgument[] | undefined, node: Command, peer?: unknown) => void;
};

export abstract class Command extends Node<CommandEvents> {
  public abstract $call(...args: any): void;

  public $handleCall(args?: OSCArgument[], peer?: unknown): undefined {
    this.$emit('remote-call', args, this, peer);
    return undefined;
  }
}
