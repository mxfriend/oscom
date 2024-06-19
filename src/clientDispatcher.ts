import { AnyEventHandler, OSCArgument } from '@mxfriend/osc';
import { Command } from './command';
import { Dispatcher, DispatcherEvents } from './dispatcher';
import { Node } from './node';
import { Value } from './values';

export class ClientDispatcher<
  TEvents extends DispatcherEvents = DispatcherEvents,
> extends Dispatcher<TEvents> {
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
