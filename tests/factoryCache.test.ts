import { FactoryCache } from '../src'

class TestClass {
  constructor(readonly id: string) {}
}

function createTestClass(id: string): TestClass {
  return new TestClass(id);
}

test('FactoryCache always returns same instance', () => {
  const cache = new FactoryCache(createTestClass);
  const a1 = cache.get('a');
  const a2 = cache.get('a');
  const b1 = cache.get('b');
  expect(a1).toBeInstanceOf(TestClass);
  expect(a1.id).toBe('a');
  expect(a2).toBe(a1);
  expect(b1).not.toBe(a1);
  expect(b1).toBeInstanceOf(TestClass);
  expect(b1.id).toBe('b');
});
