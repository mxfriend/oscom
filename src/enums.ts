export type EnumDefinition<TKeys extends string[] = string[]> = {
  [key in TKeys[number]]: number;
};

export type EnumType<Def extends EnumDefinition> = Def[keyof Def];

const enumMap = new Map<EnumDefinition, string[]>();

function normalizeEnumMap(def: EnumDefinition, values: Record<string, string> | string[] = {}, upper: boolean = true): string[] {
  if (Array.isArray(values)) {
    return values;
  }

  return Object.entries(def)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k in values ? values[k] : upper ? k.toUpperCase() : k);
}

export function createEnum<Def extends EnumDefinition>(def: Def, values?: Record<string, string> | string[], upper?: boolean): Def {
  enumMap.set(def, normalizeEnumMap(def, values, upper));
  return def;
}

export function enumNameToValue<Def extends EnumDefinition>(def: Def, k: string): EnumType<Def> {
  const values = enumMap.get(def);

  if (!values) {
    throw new TypeError('Invalid enum definition');
  }

  const idx = values.indexOf(k);

  if (idx < 0) {
    throw new TypeError(`Invalid enum key ${k}`);
  }

  return idx as EnumType<Def>;
}

export function enumValueToName<Def extends EnumDefinition>(def: Def, v: EnumType<Def>): string {
  const values = enumMap.get(def);

  if (!values) {
    throw new TypeError('Invalid enum definition');
  }

  if (v < 0 || v >= values.length) {
    throw new TypeError(`Invalid enum value ${v}`);
  }

  return values[v];
}
