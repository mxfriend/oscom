import { EnumDefinition } from './enums';
import { Container } from './container';
import { FactoryCache } from './factoryCache';
import { LinearScale } from './scales';
import { EnumValue, ScaledValue, Value } from './values';

export type ContainerPropertyDecorator = {
  (target: Container, property: string): void;
};

export type PropertyFactory = () => any;
export type PropertyWrapper<T = any> = (property: T) => T;

function adjustKnownProperties(target: any, cb: (props: string[]) => string[]): void {
  const props = Reflect.getMetadata('custom:known-properties', target) ?? [];
  Reflect.defineMetadata('custom:known-properties', cb(props), target);
}

function injectProperty(target: any, property: string, sibling: string, offset: number = 0): void {
  adjustKnownProperties(target, ([...props]) => {
    const idxOld = props.indexOf(property);
    const idxNew = props.indexOf(sibling);
    idxOld > -1 && props.splice(idxOld, 1);
    idxNew > -1 ? props.splice(idxNew + offset, 0, property) : props.push(property);
    return props;
  });
}

export function Before(sibling: string): ContainerPropertyDecorator {
  return (target, property) => {
    injectProperty(target, property, sibling);
  };
}

export function After(sibling: string): ContainerPropertyDecorator {
  return (target, property) => {
    injectProperty(target, property, sibling, 1);
  };
}

export function Property(target: Container, property: string): void {
  adjustKnownProperties(target, (props) => props.concat(property));

  Object.defineProperty(target, property, {
    get(): any {
      return this.$get(property);
    },
    set(value: any) {
      this.$set(property, value);
    },
  });
}

function getDefaultPropertyFactory(target: any, prop: string): PropertyFactory {
  return () => {
    const type = Reflect.getMetadata('design:type', target, prop);
    return new type();
  };
}

function getPropertyFactory(target: any, prop: string): PropertyFactory {
  return Reflect.getMetadata('custom:factory', target, prop) ?? getDefaultPropertyFactory(target, prop);
}

export function createFactoryDecorator(factory: PropertyFactory): ContainerPropertyDecorator {
  return (target, property) => {
    Reflect.defineMetadata('custom:factory', factory, target, property);
    Property(target, property);
  };
}

export function createFactoryWrapper(wrapper: PropertyWrapper): ContainerPropertyDecorator {
  return (target, property) => {
    const factory = getPropertyFactory(target, property);
    const wrapped = () => wrapper(factory());
    Reflect.defineMetadata('custom:factory', wrapped, target, property);

    if (!getKnownProperties(target).includes(property)) {
      Property(target, property);
    }
  };
}

export function createProperty(target: any, prop: string): any {
  const factory = getPropertyFactory(target, prop);
  return factory();
}

export function getKnownProperties(target: any): any[] {
  return Reflect.getMetadata('custom:known-properties', target) ?? [];
}

const linearScales = new FactoryCache((min: number, max: number, steps: number) => new LinearScale(min, max, steps));

export function getLinearScale(min: number, max: number, steps: number): LinearScale {
  return linearScales.get(min, max, steps);
}

export function Linear(
  min: number,
  max: number,
  steps: number,
): ContainerPropertyDecorator {
  return createFactoryDecorator(() => new ScaledValue(linearScales.get(min, max, steps)));
}

export function Enum(def: EnumDefinition): ContainerPropertyDecorator {
  return createFactoryDecorator(() => new EnumValue(def));
}

export const Nullable = createFactoryWrapper(<V extends Value<T>, T>(value: V): V => {
  value.$nullable = true;
  return value;
});

export const Echo = createFactoryWrapper(<V extends Value<T>, T>(value: V): V => {
  value.$echo = true;
  return value;
});
