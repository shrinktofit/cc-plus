import { expect, it } from 'vitest';
import { SerProtocol } from '../src/protocol.js';
import { serialize } from '@src/serialize.js';
import { deserialize } from '@src/deserialize.js';
import { registerClassMeta } from '@src/meta-registry.js';

it('protocol', () => {
  expect(SerProtocol.VERSION).toBe('202605');
});

it('string', () => {
  expectRoundTrip('hello');
});

it('finite number', () => {
  expectRoundTrip(123.5);
});

it('NaN', () => {
  const deserialized = expectSerializedSnapshotAndDeserialize(NaN);

  expect(deserialized).toBeNaN();
});

it('NaN with json5 assumptions', () => {
  const deserialized = expectSerializedSnapshotAndDeserialize(NaN, {
    assumptions: 'json5',
  });

  expect(deserialized).toBeNaN();
});

it('Infinity', () => {
  expectRoundTrip(Infinity);
});

it('Infinity with yaml assumptions', () => {
  expectRoundTrip(Infinity, {
    assumptions: 'yaml',
  });
});

it('-Infinity', () => {
  expectRoundTrip(-Infinity);
});

it('-Infinity with ieee754 assumptions', () => {
  expectRoundTrip(-Infinity, {
    assumptions: {
      ieee754: true,
    },
  });
});

it('-0', () => {
  const deserialized = expectSerializedSnapshotAndDeserialize(-0);

  expect(Object.is(deserialized, -0)).toBe(true);
});

it('boolean', () => {
  expectRoundTrip(true);
  expectRoundTrip(false);
});

it('bigint', () => {
  expectRoundTrip(12345678901234567890n);
});

it('null', () => {
  expectRoundTrip(null);
});

it('undefined', () => {
  expectRoundTrip(undefined);
});

it('array', () => {
  expectRoundTrip([
    'hello',
    123,
    true,
    123n,
    null,
    undefined,
  ]);
});

it('plain object', () => {
  expectRoundTrip({
    string: 'hello',
    number: 123,
    boolean: true,
    bigint: 123n,
    null: null,
    array: [1, 2, 3],
    object: {
      nested: true,
    },
  });
});

it('plain object omits undefined fields', () => {
  const deserialized = expectSerializedSnapshotAndDeserialize({
    keep: 1,
    omit: undefined,
  });

  expect(deserialized).toStrictEqual({
    keep: 1,
  });
});

it('symbol is unsupported', () => {
  expect(() => serialize(Symbol('unsupported'))).toThrowErrorMatchingSnapshot();
});

it('function is unsupported', () => {
  expect(() => serialize(() => undefined)).toThrowErrorMatchingSnapshot();
});

it('circular value', () => {
  const a: {
    b: undefined | typeof b;
  } = {
    b: undefined,
  };
  const b = {
    a,
  };
  a.b = b;
  const serialized = serialize(a);
  expect(serialized).toMatchSnapshot();
  const deserialized = deserialize(serialized) as {
    b: typeof b;
  };
  expect(deserialized.b.a).toBe(deserialized);
});

it('shared plain object', () => {
  const shared = {
    value: 42,
  };
  const deserialized = expectSerializedSnapshotAndDeserialize({
    a: shared,
    b: shared,
  }) as {
    a: typeof shared;
    b: typeof shared;
  };

  expect(deserialized.a).toBe(deserialized.b);
  expect(deserialized.a).toStrictEqual(shared);
});

it('Date', () => {
  const given = new Date('2026-05-16T13:30:00.000Z');

  const deserialized = expectSerializedSnapshotAndDeserialize(given);

  expect(deserialized).toBeInstanceOf(Date);
  expect((deserialized as Date).getTime()).toBe(given.getTime());
});

it('Map', () => {
  const given = new Map<unknown, unknown>([
    ['string', 'value'],
    [123, true],
    ['nested', {
      ok: true,
    }],
  ]);

  const deserialized = expectSerializedSnapshotAndDeserialize(given);

  expect(deserialized).toBeInstanceOf(Map);
  expect(Array.from((deserialized as Map<unknown, unknown>).entries())).toStrictEqual(Array.from(given.entries()));
});

it('Set', () => {
  const given = new Set<unknown>([
    'string',
    123,
    {
      ok: true,
    },
  ]);

  const deserialized = expectSerializedSnapshotAndDeserialize(given);

  expect(deserialized).toBeInstanceOf(Set);
  expect(Array.from((deserialized as Set<unknown>).values())).toStrictEqual(Array.from(given.values()));
});

it('RegExp', () => {
  const given = /hello\s+world/giu;

  const deserialized = expectSerializedSnapshotAndDeserialize(given);

  expect(deserialized).toBeInstanceOf(RegExp);
  expect((deserialized as RegExp).source).toBe(given.source);
  expect((deserialized as RegExp).flags).toBe(given.flags);
});

it.each([
  ['Int8Array', new Int8Array([-1, 0, 1])],
  ['Uint8Array', new Uint8Array([0, 1, 255])],
  ['Uint8ClampedArray', new Uint8ClampedArray([0, 128, 255])],
  ['Int16Array', new Int16Array([-32768, 0, 32767])],
  ['Uint16Array', new Uint16Array([0, 65535])],
  ['Int32Array', new Int32Array([-2147483648, 0, 2147483647])],
  ['Uint32Array', new Uint32Array([0, 4294967295])],
  ['Float32Array', new Float32Array([0.5, -1.5, 2.25])],
  ['Float64Array', new Float64Array([0.5, -1.5, Number.MAX_SAFE_INTEGER])],
  ['BigInt64Array', new BigInt64Array([-1n, 0n, 1n])],
  ['BigUint64Array', new BigUint64Array([0n, 1n, 18446744073709551615n])],
] satisfies Array<[string, ArrayBufferView]>)('%s', (_, given) => {
  const deserialized = expectSerializedSnapshotAndDeserialize(given);

  expect(deserialized).toBeInstanceOf(given.constructor);
  expect(Array.from(deserialized as ArrayLike<unknown>)).toStrictEqual(Array.from(given as ArrayLike<unknown>));
});

it('registered class fields', () => {
  class Player {
    name = '';
    level = 0;
    ignored = 'default';
  }

  registerClassMeta(Player, {
    id: 'test.Player',
    fields: ['name', 'level'],
  });

  const given = new Player();
  given.name = 'Ada';
  given.level = 7;
  given.ignored = 'runtime';

  const deserialized = expectSerializedSnapshotAndDeserialize(given) as Player;

  expect(deserialized).toBeInstanceOf(Player);
  expect(deserialized.name).toBe('Ada');
  expect(deserialized.level).toBe(7);
  expect(deserialized.ignored).toBe('default');
});

it('fixed registered class field omits nested type info', () => {
  class Point {
    x = 0;
    y = 0;
  }

  class Transform {
    point = new Point();
  }

  registerClassMeta(Point, {
    id: 'test.FixedPoint',
    fields: ['x', 'y'],
  });
  registerClassMeta(Transform, {
    id: 'test.Transform',
    fields: [
      ['point', {
        type: Point,
        fixed: true,
      }],
    ],
  });

  const given = new Transform();
  given.point.x = 1;
  given.point.y = 2;

  const deserialized = expectSerializedSnapshotAndDeserialize(given) as Transform;

  expect(deserialized).toBeInstanceOf(Transform);
  expect(deserialized.point).toBeInstanceOf(Point);
  expect(deserialized.point).toStrictEqual(given.point);
});

it('fixed custom class field stores custom payload directly', () => {
  class EventRecord {
    createdAt = new Date(0);
  }

  registerClassMeta(EventRecord, {
    id: 'test.EventRecord',
    fields: [
      ['createdAt', {
        type: Date,
        fixed: true,
      }],
    ],
  });

  const given = new EventRecord();
  given.createdAt = new Date('2026-05-16T13:30:00.000Z');

  const deserialized = expectSerializedSnapshotAndDeserialize(given) as EventRecord;

  expect(deserialized).toBeInstanceOf(EventRecord);
  expect(deserialized.createdAt).toBeInstanceOf(Date);
  expect(deserialized.createdAt.getTime()).toBe(given.createdAt.getTime());
});

it('registered class is shared by default', () => {
  class SharedPoint {
    x = 0;
  }

  registerClassMeta(SharedPoint, {
    id: 'test.SharedPoint',
    fields: ['x'],
  });

  const shared = new SharedPoint();
  shared.x = 42;

  const deserialized = expectSerializedSnapshotAndDeserialize({
    a: shared,
    b: shared,
  }) as {
    a: SharedPoint;
    b: SharedPoint;
  };

  expect(deserialized.a).toBeInstanceOf(SharedPoint);
  expect(deserialized.a).toBe(deserialized.b);
  expect(deserialized.a.x).toBe(42);
});

it('nonShared registered class is serialized by value', () => {
  class NonSharedPoint {
    x = 0;
  }

  registerClassMeta(NonSharedPoint, {
    id: 'test.NonSharedPoint',
    fields: ['x'],
    nonShared: true,
  });

  const shared = new NonSharedPoint();
  shared.x = 42;

  const deserialized = expectSerializedSnapshotAndDeserialize({
    a: shared,
    b: shared,
  }) as {
    a: NonSharedPoint;
    b: NonSharedPoint;
  };

  expect(deserialized.a).toBeInstanceOf(NonSharedPoint);
  expect(deserialized.b).toBeInstanceOf(NonSharedPoint);
  expect(deserialized.a).not.toBe(deserialized.b);
  expect(deserialized.a).toStrictEqual(deserialized.b);
});

function expectRoundTrip<T>(value: T, options?: Parameters<typeof serialize>[1]) {
  expect(expectSerializedSnapshotAndDeserialize(value, options)).toStrictEqual(value);
}

function expectSerializedSnapshotAndDeserialize(value: unknown, options?: Parameters<typeof serialize>[1]) {
  const serialized = serialize(value, options);
  expect(serialized).toMatchSnapshot();
  return deserialize(serialized);
}
