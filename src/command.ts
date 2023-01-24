import { OSCArgument } from '@mxfriend/osc';
import { Node, NodeEvents } from './node';

export interface CommandEvents extends NodeEvents {
  'local-call': [args: OSCArgument[], node: Command];
  'remote-call': [args: OSCArgument[], node: Command, peer?: unknown];
}

export abstract class Command<
  TEvents extends CommandEvents = CommandEvents,
> extends Node<TEvents> {
  public abstract $call(...args: any): void;

  get $callable(): boolean {
    return true;
  }

  public $handleCall(peer?: unknown, ...args: OSCArgument[]): undefined {
    this.$emit('remote-call', args, this, peer);
    return undefined;
  }
}
