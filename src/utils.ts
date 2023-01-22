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
