import { OSCArgument, assertOSCType, isOSCType } from '@mxfriend/osc';
import { inspect } from 'util';
import { EnumDefinition, enumNameToValue, enumValueToName } from './enums';
import { Node, NodeEvents } from './node';
import { Scale } from './scales';


export type ValueEvents<T = any> = NodeEvents & {
  'local-change': (event: 'local-change', node: Value<T>, value: T | undefined) => void;
  'remote-change': (event: 'remote-change', node: Value<T>, value: T | undefined) => void;
};

const $value = Symbol('value');

export abstract class Value<T = any> extends Node<ValueEvents<T>> {
  private [$value]?: T = undefined;

  $get(): T | undefined {
    return this[$value];
  }

  $set(value: T | undefined, local: boolean = true): void {
    if (value !== this[$value]) {
      this[$value] = value;
      this.$emit(local ? 'local-change' : 'remote-change', this, value);
    }
  }

  $isSet(): boolean {
    return this[$value] !== undefined;
  }

  get $callable(): boolean {
    return true;
  }

  $handleCall(arg?: OSCArgument): OSCArgument | undefined {
    if (arg) {
      this.$fromOSC(arg);
      return undefined;
    } else {
      return this.$toOSC();
    }
  }

  abstract $fromOSC(arg: OSCArgument): void;
  abstract $toOSC(): OSCArgument | undefined;

  [inspect.custom]() {
    if (this[$value] === undefined) {
      return 'not set';
    }

    return `${this[$value]}`;
  }
}

const $type = Symbol('type');

export abstract class NumericValue extends Value<number> {
  private readonly [$type]: 'i' | 'f';

  protected constructor(type: 'i' | 'f') {
    super();
    this[$type] = type;
  }

  $fromOSC(arg: OSCArgument): void {
    assertOSCType(arg, this[$type]);
    this.$set(arg.value);
  }

  $toOSC(): OSCArgument | undefined {
    const value = this.$get();
    return value === undefined ? undefined : { type: this[$type], value };
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

  $fromValue(value: number): void {
    this.$set(this[$scale].valueToRaw(value));
  }

  $fromOSC(arg: OSCArgument) {
    if (isOSCType(arg, 'i')) {
      this.$fromValue(arg.value);
    } else {
      super.$fromOSC(arg);
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

  $fromOSC(arg: OSCArgument): void {
    if (isOSCType(arg, 's')) {
      this.$set(enumNameToValue(this[$def], arg.value) as T);
    } else {
      assertOSCType(arg, 'i');
      this.$set(arg.value as T);
    }
  }

  $toOSC(): OSCArgument | undefined {
    const value = this.$get();
    return value === undefined ? undefined : { type: 'i', value };
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
  $fromOSC(arg: OSCArgument): void {
    assertOSCType(arg, 's');
    this.$set(arg.value);
  }

  $toOSC(): OSCArgument | undefined {
    const value = this.$get();
    return value === undefined ? undefined : { type: 's', value };
  }
}
