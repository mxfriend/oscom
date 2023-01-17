import { Container } from './container';
import { Node } from './node';

const $map = Symbol('map');

export class Root extends Container {
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

    if (!node && need) {
      throw new Error(`Address not found: '${address}'`);
    }

    return node;
  };

  private $setupContainer(container: Container): void {
    container.$on('attach', this.$handleAttach);

    for (const [, node] of container.$entries(true)) {
      this.$handleAttach('attach', container, node);
    }
  }

  private $handleAttach(evt: 'attach', node: Container, child: Node): void {
    this[$map].set(child.$address, child);
    child.$on('detached', this.$handleDetached);

    if (child instanceof Container) {
      this.$setupContainer(child);
    }
  }

  private $handleDetached(evt: 'detached', node: Node, address: string): void {
    this[$map].delete(address);
    node.$off('detached', this.$handleDetached);

    if (node instanceof Container) {
      node.$off('attach', this.$handleAttach);
    }
  }
}
