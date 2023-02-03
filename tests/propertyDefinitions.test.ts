import { After, Before, Container, Node, Property } from '../src';

class TestNode extends Node {}

class TestContainer extends Container {
  @Property test1: TestNode;
  @Property test2: TestNode;
}

class TestDescendantContainer extends TestContainer {}

class TestDescendantContainerWithProperties extends TestContainer {
  @Property test3: TestNode;
}

class TestGrandchildContainer extends TestDescendantContainerWithProperties {
  @Property test4: TestNode;
}

class TestInjectBeforeContainer extends TestContainer {
  @Before('test2') @Property test3: TestNode;
}

class TestInjectAfterContainer extends TestContainer {
  @After('test1') @Property test3: TestNode;
}

class TestGrandchildContainerWithCustomOrderInParent extends TestInjectBeforeContainer {
  @Property test4: TestNode;
}






test('properties are defined using decorators', () => {
  const container = new TestContainer();
  expect(container.$getKnownProperties()).toEqual(['test1', 'test2']);
});

test('descendant containers inherit parent properties', () => {
  const container = new TestDescendantContainer();
  expect(container.$getKnownProperties()).toEqual(['test1', 'test2']);
});

test('descendant containers own properties go after parent properties by default', () => {
  const container = new TestDescendantContainerWithProperties();
  expect(container.$getKnownProperties()).toEqual(['test1', 'test2', 'test3']);
});

test('inheritance works with multiple levels', () => {
  const container = new TestGrandchildContainer();
  expect(container.$getKnownProperties()).toEqual(['test1', 'test2', 'test3', 'test4']);
});

test('descendant property order can be changed by decorators', () => {
  const before = new TestInjectBeforeContainer();
  const after = new TestInjectAfterContainer();
  expect(before.$getKnownProperties()).toEqual(['test1', 'test3', 'test2']);
  expect(after.$getKnownProperties()).toEqual(['test1', 'test3', 'test2']);
});

test('manual property order is preserved even in descendant classes', () => {
  const container = new TestGrandchildContainerWithCustomOrderInParent();
  expect(container.$getKnownProperties()).toEqual(['test1', 'test3', 'test2', 'test4']);
});
