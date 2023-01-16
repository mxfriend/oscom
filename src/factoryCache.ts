export type CacheFactory = (...args: any) => any;

export class FactoryCache<F extends CacheFactory> implements Iterable<ReturnType<F>> {
  private readonly values: Map<string, ReturnType<F>>;
  private readonly factory: F;

  constructor(factory: F) {
    this.values = new Map();
    this.factory = factory;
  }

  get(...args: Parameters<F>): ReturnType<F> {
    const key = args.join('|');
    this.values.has(key) || this.values.set(key, this.factory(...args as any));
    return this.values.get(key)!;
  }

  delete(...args: Parameters<F>): void {
    this.values.delete(args.join('|'));
  }

  [Symbol.iterator](): IterableIterator<ReturnType<F>> {
    return this.values.values();
  }
}
