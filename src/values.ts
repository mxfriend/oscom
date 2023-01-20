import { OSCArgument, assertOSCType, isOSCType, osc } from '@mxfriend/osc';
import { inspect } from 'util';
import { EnumDefinition, enumNameToValue, enumValueToName } from './enums';
import { Node } from './node';
import { Scale } from './scales';


export type ValueEvents<T = any> = {
  'local-change': (value: T | undefined, node: Value<T>) => void;
  'remote-change': (value: T | undefined, node: Value<T>, peer?: unknown) => void;
};

const $value = Symbol('value');

export abstract class Value<T = any> extends Node<ValueEvents<T>> {
  private [$value]?: T = undefined;

  $get(): T | undefined {
    return this[$value];
  }

  $set(value: T | undefined, local: boolean = true, peer?: unknown): void {
    if (value !== this[$value]) {
      this[$value] = value;
      this.$emit(local ? 'local-change' : 'remote-change', value, this, peer);
    }
  }

  $isSet(): boolean {
    return this[$value] !== undefined;
  }

  get $callable(): boolean {
    return true;
  }

  $handleCall(args?: OSCArgument[], peer?: unknown): OSCArgument | undefined {
    if (args?.length) {
      this.$fromOSC(args[0], false, peer);
      return undefined;
    } else {
      return this.$toOSC();
    }
  }

  abstract $fromOSC(arg: OSCArgument, local?: boolean, peer?: unknown): void;
  abstract $toOSC(): OSCArgument | undefined;

  [inspect.custom]() {
    if (this[$value] === undefined) {
      return 'not set';
    }

    return `${this[$value]}`;
  }
}

const $type = Symbol('type');
const $toOSC = Symbol('toOSC');

export abstract class NumericValue extends Value<number> {
  private readonly [$type]: 'i' | 'f';
  private readonly [$toOSC]: (value?: number) => OSCArgument | undefined;

  protected constructor(type: 'i' | 'f') {
    super();
    this[$type] = type;
    this[$toOSC] = type === 'i' ? osc.optional.int : osc.optional.float;
  }

  get $type(): 'i' | 'f' {
    return this[$type];
  }

  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    assertOSCType(arg, this[$type]);
    this.$set(arg.value, local, peer);
  }

  $toOSC(): OSCArgument | undefined {
    return this[$toOSC](this.$get());
  }
}

export class IntValue extends NumericValue {
  constructor() {
    super('i');
  }
}

export class FloatValue extends NumericValue {
  constructor() {
    super('f');
  }
}

const $scale = Symbol('scale');

export class ScaledValue extends FloatValue {
  private readonly [$scale]: Scale;

  constructor(scale: Scale) {
    super();
    this[$scale] = scale;
  }

  $fromValue(value: number, local: boolean = true): void {
    this.$set(this[$scale].valueToRaw(value), local);
  }

  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown) {
    if (isOSCType(arg, 'i')) {
      this.$set(this[$scale].valueToRaw(arg.value), local, peer);
    } else {
      super.$fromOSC(arg, local);
    }
  }

  $toValue(): number | undefined {
    const value = this.$get();
    return value === undefined ? undefined : this[$scale].rawToValue(value);
  }

  [inspect.custom]() {
    const raw = this.$get();
    const value = this.$toValue();

    if (raw === undefined) {
      return 'not set';
    }

    return `${raw} (${value})`;
  }
}

const $def = Symbol('def');

export class EnumValue<T extends number> extends Value<T> {
  private readonly [$def]: EnumDefinition;

  constructor(def: EnumDefinition) {
    super();
    this[$def] = def;
  }

  $fromValue(value: string, local: boolean = true): void {
    this.$set(enumNameToValue(this[$def], value) as T, local);
  }

  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    if (isOSCType(arg, 's')) {
      this.$set(enumNameToValue(this[$def], arg.value) as T, local, peer);
    } else {
      assertOSCType(arg, 'i');
      this.$set(arg.value as T, local);
    }
  }

  $toValue(): string | undefined  {
    const value = this.$get();
    return value === undefined ? undefined : enumValueToName(this[$def], value);
  }

  $toOSC(): OSCArgument | undefined {
    return osc.optional.int(this.$get());
  }

  [inspect.custom]() {
    const value = this.$get();

    if (value === undefined) {
      return 'not set';
    }

    return `${value} (${enumValueToName(this[$def], value)})`;
  }
}

export class StringValue extends Value<string> {
  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    assertOSCType(arg, 's');
    this.$set(arg.value, local, peer);
  }

  $toOSC(): OSCArgument | undefined {
    return osc.optional.string(this.$get());
  }
}
