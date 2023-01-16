export interface Scale {
  rawToValue(value: number): number;
  valueToRaw(value: number): number;
}

export class LinearScale implements Scale {
  private readonly min: number;
  private readonly max: number;
  private readonly steps: number;

  constructor(min: number, max: number, steps: number) {
    this.min = min;
    this.max = max;
    this.steps = steps;
  }

  rawToValue(value: number): number {
    return this.min + value * (this.max - this.min);
  }

  valueToRaw(value: number): number {
    return quantize((limit(value, this.min, this.max) - this.min) / (this.max - this.min), this.steps);
  }
}

export function limit(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function quantize(value: number, steps: number): number {
  return Math.trunc(value * (steps - 0.5)) / (steps - 1);
}
