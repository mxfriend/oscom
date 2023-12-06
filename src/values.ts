import { OSCArgument, osc, OSCInt, OSCFloat } from '@mxfriend/osc';
import { EnumDefinition, enumNameToValue, enumValueToName } from './enums';
import { Node, NodeEvents } from './node';
import { Scale } from './scales';


export interface ValueEvents<T = any> extends NodeEvents {
  'local-change': [value: T | undefined, node: Value<T>];
  'remote-change': [value: T | undefined, node: Value<T>, peer?: unknown];
}

const $value = Symbol('value');
const $nullable = Symbol('nullable');
const $echo = Symbol('echo');

export abstract class Value<
  T = any,
  TEvents extends ValueEvents<T> = ValueEvents<T>,
> extends Node<TEvents> {
  private [$value]?: T = undefined;
  private [$nullable]: boolean = false;
  private [$echo]: boolean = false;

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

  get $nullable(): boolean {
    return this[$nullable];
  }

  set $nullable(nullable: boolean) {
    this[$nullable] = nullable;
  }

  get $echo(): boolean {
    return this[$echo];
  }

  set $echo(echo: boolean) {
    this[$echo] = echo;
  }

  $handleCall(peer?: unknown, arg?: OSCArgument): OSCArgument | undefined {
    if (arg) {
      this.$fromOSC(arg, false, peer);
      return this[$echo] ? this.$toOSC() : undefined;
    } else {
      return this.$toOSC();
    }
  }

  $fromOSC(arg: OSCArgument, local?: boolean, peer?: unknown): void {
    if (this[$nullable] && osc.is.null(arg)) {
      this.$set(undefined, local, peer);
    }
  }

  $toOSC(): OSCArgument | undefined {
    return this[$nullable] && this.$get() === undefined ? osc.null() : undefined;
  }
}

const $type = Symbol('type');
const $isValidType = Symbol('isValidType');
const $toOSC = Symbol('toOSC');

export abstract class NumericValue extends Value<number> {
  private readonly [$type]: 'i' | 'f';
  private readonly [$isValidType]: (value: OSCArgument) => value is (OSCInt | OSCFloat);
  private readonly [$toOSC]: (value?: number) => OSCArgument | undefined;

  protected constructor(type: 'i' | 'f') {
    super();
    this[$type] = type;
    this[$isValidType] = type === 'i' ? osc.is.int : osc.is.float;
    this[$toOSC] = type === 'i' ? osc.optional.int : osc.optional.float;
  }

  get $type(): 'i' | 'f' {
    return this[$type];
  }

  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    if (this[$isValidType](arg)) {
      this.$set(arg.value, local, peer);
    } else {
      super.$fromOSC(arg, local, peer);
    }
  }

  $toOSC(): OSCArgument | undefined {
    return super.$toOSC() ?? this[$toOSC](this.$get());
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

  $fromValue(value?: number, local: boolean = true): void {
    this.$set(value === undefined ? undefined : this[$scale].valueToRaw(value), local);
  }

  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown) {
    if (osc.is.int(arg)) {
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

  $fromValue(value?: string, local: boolean = true): void {
    this.$set(value === undefined ? undefined : enumNameToValue(this[$def], value) as T, local);
  }

  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    if (osc.is.string(arg)) {
      this.$set(enumNameToValue(this[$def], arg.value) as T, local, peer);
    } else if (osc.is.int(arg)) {
      this.$set(arg.value as T, local);
    } else {
      super.$fromOSC(arg, local, peer);
    }
  }

  $toValue(): string | undefined  {
    const value = this.$get();
    return value === undefined ? undefined : enumValueToName(this[$def], value);
  }

  $toOSC(): OSCArgument | undefined {
    return super.$toOSC() ?? osc.optional.int(this.$get());
  }
}

export class StringValue extends Value<string> {
  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    if (osc.is.string(arg)) {
      this.$set(arg.value, local, peer);
    } else {
      super.$fromOSC(arg, local, peer);
    }
  }

  $toOSC(): OSCArgument | undefined {
    return super.$toOSC() ?? osc.optional.string(this.$get());
  }
}

export class BooleanValue extends Value<boolean> {
  $fromOSC(arg: OSCArgument, local: boolean = false, peer?: unknown): void {
    if (osc.is.bool(arg)) {
      this.$set(arg.value, local, peer);
    } else {
      super.$fromOSC(arg, local, peer);
    }
  }

  $toOSC(): OSCArgument | undefined {
    return super.$toOSC() ?? osc.optional.bool(this.$get());
  }
}
