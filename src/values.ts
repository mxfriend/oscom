import { OSCArgument, isOSCType, osc } from '@mxfriend/osc';
import { EnumDefinition, enumNameToValue, enumValueToName } from './enums';
import { Node, NodeEvents } from './node';
import { Scale } from './scales';


export interface ValueEvents<T = any> extends NodeEvents {
  'local-change': [value: T | undefined, node: Value<T>];
  'remote-change': [value: T | undefined, node: Value<T>, peer?: unknown];
}

const $value = Symbol('value');

export abstract class Value<
  T = any,
  TEvents extends ValueEvents<T> = ValueEvents<T>,
> extends Node<TEvents> {
  private [$value]?: T = undefined;

  $get(): T | undefined {
    return this[$value];
  }

  $set(value: T | undefined, local: boolean = true, peer?: unknown): void {
    if (value !== this[$value]) {
      this[$value] = value;

      if (local) {
        this.$emit('local-change', value, this);
      } else {
        this.$emit('remote-change', value, this, peer);
      }
    }
  }

  $isSet(): boolean {
    return this[$value] !== undefined;
  }

  get $callable(): boolean {
    return true;
  }

  $handleCall(peer?: unknown, arg?: OSCArgument): OSCArgument | undefined {
    if (arg) {
      this.$fromOSC(arg, false, peer);
      return undefined;
    } else {
      return this.$toOSC();
    }
  }

  abstract $fromOSC(arg: OSCArgument, local?: boolean, peer?: unknown): void;
  abstract $toOSC(): OSCArgument | undefined;
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
    if (isOSCType(arg, this[$type])) {
      this.$set(arg.value, local, peer);
    }
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
    } else if (isOSCType(arg, 'i')) {
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
}

export class StringValue extends Value<string> {
  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    if (isOSCType(arg, 's')) {
      this.$set(arg.value, local, peer);
    }
  }

  $toOSC(): OSCArgument | undefined {
    return osc.optional.string(this.$get());
  }
}
