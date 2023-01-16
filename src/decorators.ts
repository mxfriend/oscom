import { EnumDefinition } from './enums';
import { Container } from './container';
import { FactoryCache } from './factoryCache';
import { LinearScale } from './scales';
import { EnumValue, ScaledValue } from './values';

export type ContainerPropertyDecorator = {
  (target: Container, property: string): void;
};

export type PropertyFactory = () => any;

export function Property(target: Container, property: string): void {
  Reflect.defineMetadata(
    'custom:known-properties',
    (Reflect.getMetadata('custom:known-properties', target) || []).concat(property),
    target
  );

  Object.defineProperty(target, property, {
    get(): any {
      return this.$get(property);
    },
    set(value: any) {
      this.$set(property, value);
    },
  });
}

export function createFactoryDecorator(factory: PropertyFactory): ContainerPropertyDecorator {
  return (target, property) => {
    Reflect.defineMetadata('custom:factory', factory, target, property);
    Property(target, property);
  };
}

export function createProperty(target: any, prop: string): any {
  const factory = Reflect.getMetadata('custom:factory', target, prop);

  if (factory) {
    return factory();
  }

  const type = Reflect.getMetadata('design:type', target, prop);
  return new type();
}

export function getKnownProperties(target: any): any[] {
  return Reflect.getMetadata('custom:known-properties', target) ?? [];
}

const linearScales = new FactoryCache((min: number, max: number, steps: number) => new LinearScale(min, max, steps));

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
