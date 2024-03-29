import { Container } from './container';
import { Node } from './node';
import { Value } from './values';

export function toSignificantDigits(value: number, digits: number, round: boolean = false): string {
  if (value > -10 && value < 10) {
    return toDecimalPlaces(value, digits - 1, round);
  }

  const e = Math.floor(Math.log10(Math.abs(value)));
  const scale = Math.pow(10, e - digits + 1);
  const scaled = value / scale;
  const truncated = round ? Math.round(scaled) : Math.trunc(scaled);
  const result = truncated * scale;
  return result.toFixed(Math.max(0, digits - e - 1));
}

export function toDecimalPlaces(value: number, places: number, round: boolean = false): string {
  const scale = Math.pow(10, places);
  const result = ((round ? Math.round(value * scale) : Math.trunc(value * scale)) / scale);
  return result.toFixed(places);
}

export function * pairs<T>(a: Iterable<T>, b: Iterable<T>): IterableIterator<[T, T]> {
  const ita = a[Symbol.iterator]();
  const itb = b[Symbol.iterator]();

  for (let ra = ita.next(), rb = itb.next(); !ra.done && !rb.done; ra = ita.next(), rb = itb.next()) {
    yield [ra.value, rb.value];
  }
}

export function walkValues(node: Node, callback: (value: Value) => void): void {
  if (node instanceof Container) {
    for (const child of node.$children()) {
      walkValues(child, callback);
    }
  } else if (node instanceof Value) {
    callback(node);
  }
}
