import { expect, it } from 'vitest';
import { serClass, serField } from '../src/legacy-decorators.js';
import { getClassMeta } from '../src/meta-registry.js';
import type { ClassMeta } from '../src/meta-registry.js';

interface ApplyLegacyDecoratorsOptions<T> {
  classDecorator?: (constructor: new (...args: any[]) => T) => void;
  fields?: {
    prototype: object;
    key: string | symbol;
    decorator: PropertyDecorator;
  }[];
}

function applyLegacyDecorators<T>(
  cls: new (...args: any[]) => T,
  opts: ApplyLegacyDecoratorsOptions<T>,
): void {
  if (opts.fields) {
    for (const field of opts.fields) {
      field.decorator(field.prototype, field.key);
    }
  }
  if (opts.classDecorator) {
    opts.classDecorator(cls);
  }
}

it('@serClass registers class meta with string id', () => {
  class MyClass {
  }

  applyLegacyDecorators(MyClass, {
    classDecorator: serClass('MyClass'),
  });

  const meta = getClassMeta(MyClass);
  expect(meta).toBeDefined();
  expect(meta.id).toBe('MyClass');
});

it('@serClass registers class meta with options object', () => {
  class MyClass2 {
  }

  applyLegacyDecorators(MyClass2, {
    classDecorator: serClass({ id: 'MyClass2' }),
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

  applyLegacyDecorators(Player, {
    fields: [
      { prototype: Player.prototype, key: 'name', decorator: serField() },
      { prototype: Player.prototype, key: 'level', decorator: serField({ fixed: true }) },
    ],
    classDecorator: serClass('Player'),
  });

  const meta = getClassMeta(Player) as ClassMeta<any>;
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
    x = 1;
    y = 2;
  }

  applyLegacyDecorators(Empty, {
    classDecorator: serClass('Empty'),
  });

  const meta = getClassMeta(Empty);
  expect(meta).toBeDefined();
  expect(meta.id).toBe('Empty');
  expect(meta.fields).toBeUndefined();
});

it('serClass consumes and cleans up fieldMetaStore', () => {
  class CleanupCheck {
    name = '';
  }

  applyLegacyDecorators(CleanupCheck, {
    fields: [
      { prototype: CleanupCheck.prototype, key: 'name', decorator: serField() },
    ],
    classDecorator: serClass('CleanupCheck'),
  });

  const meta = getClassMeta(CleanupCheck) as ClassMeta<any>;
  expect(meta.fields!.name).toBeDefined();

  // serClass should have cleaned up the WeakMap entry; apply another
  // serClass with different id to confirm no interference from stale data
  applyLegacyDecorators(CleanupCheck, {
    classDecorator: serClass('CleanupCheckReregister'),
  });

  const meta2 = getClassMeta(CleanupCheck) as ClassMeta<any>;
  expect(meta2.id).toBe('CleanupCheckReregister');
  // After cleanup, re-applying serClass without serField should result in no fields
  expect(meta2.fields).toBeUndefined();
});
