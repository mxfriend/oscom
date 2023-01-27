import { Container, ContainerEvents } from './container';
import { Node } from './node';

const $map = Symbol('map');

export class Root<TEvents extends ContainerEvents = ContainerEvents> extends Container<TEvents> {
  private readonly [$map]: Map<string, Node> = new Map();

  constructor() {
    super();
    this.$handleAttach = this.$handleAttach.bind(this);
    this.$handleDetached = this.$handleDetached.bind(this);
    this.$setupContainer(this);
  }

  $lookup(address: string, need: false): Node | undefined;
  $lookup(address: string, need?: true): Node;
  $lookup(address: string, need: boolean = true): Node | undefined {
    const node = this[$map].get(address);

    if (node) {
      return node;
    }

    const path = address.replace(/^\//, '').split(/\//g);
    let cursor: Node = this;

    for (let prop of path) {
      if (!(cursor instanceof Container) || !cursor.$has(prop)) {
        throw new Error(`Address not found: '${address}'`);
      }

      cursor = cursor.$get(prop);
    }

    return cursor;
  };

  private $setupContainer(container: Container): void {
    container.$on('attach', this.$handleAttach);

    for (const child of container.$children(true)) {
      this.$handleAttach(child);
    }
  }

  private $handleAttach(child: Node): void {
    this[$map].set(child.$address, child);
    child.$on('detached', this.$handleDetached);

    if (child instanceof Container) {
      this.$setupContainer(child);
    }
  }

  private $handleDetached(parent: Container, address: string, node: Node): void {
    this[$map].delete(address);
    node.$off('detached', this.$handleDetached);

    if (node instanceof Container) {
      node.$off('attach', this.$handleAttach);
    }
  }
}
