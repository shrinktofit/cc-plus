import { expect, it } from 'vitest';
import { serClass, serField } from '../src/decorators.js';
import { getClassMeta } from '../src/meta-registry.js';

it('@serClass registers class meta with string id', () => {
  class MyClass {
  }

  const decorator = serClass('MyClass');
  decorator(MyClass, {
    kind: 'class',
    name: 'MyClass',
    metadata: {},
    addInitializer: () => undefined,
  });

  const meta = getClassMeta(MyClass);
  expect(meta).toBeDefined();
  expect(meta.id).toBe('MyClass');
});

it('@serClass registers class meta with options object', () => {
  class MyClass2 {
  }

  const decorator = serClass({ id: 'MyClass2' });
  decorator(MyClass2, {
    kind: 'class',
    name: 'MyClass2',
    metadata: {},
    addInitializer: () => undefined,
  });

  const meta = getClassMeta(MyClass2);
  expect(meta).toBeDefined();
  expect(meta.id).toBe('MyClass2');
});

it('@serClass with @serField registers fields', () => {
  class Player {
    name = '';
    level = 0;
  }

  const metadata: Record<symbol, any> = {};

  const serFieldDecorator = serField();
  serFieldDecorator(undefined, {
    kind: 'field',
    name: 'name',
    metadata,
    access: { get: () => undefined, set: () => undefined },
    isStatic: false,
    isPrivate: false,
  });

  const serFieldFixedDecorator = serField({ fixed: true });
  serFieldFixedDecorator(undefined, {
    kind: 'field',
    name: 'level',
    metadata,
    access: { get: () => undefined, set: () => undefined },
    isStatic: false,
    isPrivate: false,
  });

  const serClassDecorator = serClass('Player');
  serClassDecorator(Player, {
    kind: 'class',
    name: 'Player',
    metadata,
    addInitializer: () => undefined,
  });

  const meta = getClassMeta(Player);
  expect(meta).toBeDefined();
  expect(meta.id).toBe('Player');
  expect(meta.fields).toBeDefined();
  expect(meta.fields!.name).toBeDefined();
  expect(meta.fields!.name.fixed).toBeUndefined();
  expect(meta.fields!.level).toBeDefined();
  expect(meta.fields!.level.fixed).toBe(true);
});

it('@serClass without @serField registers no fields', () => {
  class Empty {
  }

  const decorator = serClass('Empty');
  decorator(Empty, {
    kind: 'class',
    name: 'Empty',
    metadata: {},
    addInitializer: () => undefined,
  });

  const meta = getClassMeta(Empty);
  expect(meta).toBeDefined();
  expect(meta.id).toBe('Empty');
  expect(meta.fields).toBeUndefined();
});

it('@serField on auto-accessor', () => {
  const metadata: Record<symbol, any> = {};

  const serFieldDecorator = serField();
  serFieldDecorator(undefined, {
    kind: 'accessor',
    name: 'value',
    metadata,
    access: { get: () => undefined, set: () => undefined },
    isStatic: false,
    isPrivate: false,
  });

  let WithAccessor!: new (...args: any[]) => any;

  const serClassDecorator = serClass('WithAccessor');
  serClassDecorator(WithAccessor = class {
    value = 42;
  }, {
    kind: 'class',
    name: 'WithAccessor',
    metadata,
    addInitializer: () => undefined,
  });

  const meta = getClassMeta(WithAccessor);
  expect(meta.fields!.value).toBeDefined();
});

it('@serField on symbol-named field', () => {
  const metadata: Record<symbol, any> = {};

  const serFieldDecorator = serField();
  serFieldDecorator(undefined, {
    kind: 'field',
    name: Symbol('privateField'),
    metadata,
    access: { get: () => undefined, set: () => undefined },
    isStatic: false,
    isPrivate: true,
  });

  class WithSymbolField {
  }

  const serClassDecorator = serClass('WithSymbolField');
  serClassDecorator(WithSymbolField, {
    kind: 'class',
    name: 'WithSymbolField',
    metadata,
    addInitializer: () => undefined,
  });

  const meta = getClassMeta(WithSymbolField);
  expect(meta.fields!.privateField).toBeDefined();
});
