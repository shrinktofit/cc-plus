import { describe, it, expect } from 'vitest';
import { simplify } from '../src/simplification.js';
import type { Serialization } from '../src/serialization.js';

describe('simplify', () => {
  it('returns primitive values as-is', () => {
    expect(simplify(42)).toBe(42);
    expect(simplify('hello')).toBe('hello');
    expect(simplify(true)).toBe(true);
    expect(simplify(false)).toBe(false);
    expect(simplify(null)).toBe(null);
  });

  it('returns empty array as-is', () => {
    expect(simplify([])).toEqual([]);
  });

  it('wraps a single plain object in an array and returns it', () => {
    const obj: Serialization.SerializedObject = { a: 1, b: 'text' };
    expect(simplify(obj)).toEqual([{ a: 1, b: 'text' }]);
  });

  it('inlines a value referenced only once', () => {
    const doc: Serialization.SerializedObject[] = [
      { ref: { __id__: 1 } },
      { val: 42 },
    ];
    expect(simplify(doc)).toEqual([{ ref: { val: 42 } }]);
  });

  it('keeps a value referenced multiple times in the shared array', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: { __id__: 1 }, b: { __id__: 1 } },
      { val: 42 },
    ];
    const result = simplify(doc) as Serialization.SerializedObject[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ a: { __id__: 1 }, b: { __id__: 1 } });
    expect(result[1]).toEqual({ val: 42 });
  });

  it('remaps __id__ indices when earlier indices are dropped', () => {
    const doc: Serialization.SerializedObject[] = [
      { ref: { __id__: 2 }, alsoRef: { __id__: 2 } },
      { unused: true },
      { shared: 'val' },
    ];
    const result = simplify(doc) as Serialization.SerializedObject[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ref: { __id__: 1 }, alsoRef: { __id__: 1 } });
    expect(result[1]).toEqual({ shared: 'val' });
  });

  it('removes unreferenced values from the shared array', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: 1 },
      { orphan: true },
    ];
    expect(simplify(doc)).toEqual([{ a: 1 }]);
  });

  it('handles a single object with an inline nested object', () => {
    const obj: Serialization.SerializedObject = { a: { b: 2 } };
    expect(simplify(obj)).toEqual([{ a: { b: 2 } }]);
  });

  it('resolves nested references when inlining', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: { __id__: 1 } },
      { b: { __id__: 2 } },
      { c: 42 },
    ];
    expect(simplify(doc)).toEqual([{ a: { b: { c: 42 } } }]);
  });

  it('handles null values in the document', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: null, b: { __id__: 1 } },
      { val: 42 },
    ];
    expect(simplify(doc)).toEqual([{ a: null, b: { val: 42 } }]);
  });

  it('handles boolean false values', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: false, b: { __id__: 1 } },
      { val: 0 },
    ];
    expect(simplify(doc)).toEqual([{ a: false, b: { val: 0 } }]);
  });

  it('handles typed objects (with __type__)', () => {
    const doc: Serialization.SerializedObject[] = [
      { __type__: 'Foo', x: 1, y: { __id__: 1 } },
      { __type__: 'Bar', z: 2 },
    ];
    expect(simplify(doc)).toEqual([
      { __type__: 'Foo', x: 1, y: { __type__: 'Bar', z: 2 } },
    ]);
  });

  it('preserves a typed object kept in the shared array', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: { __id__: 1 }, b: { __id__: 1 } },
      { __type__: 'Bar', z: 2 },
    ];
    const result = simplify(doc) as Serialization.SerializedObject[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ a: { __id__: 1 }, b: { __id__: 1 } });
    expect(result[1]).toEqual({ __type__: 'Bar', z: 2 });
  });

  it('handles an object with multiple keys', () => {
    const doc: Serialization.SerializedObject[] = [
      {
        x: 1,
        y: { __id__: 1 },
        z: { __id__: 1 },
      },
      { nested: true },
    ];
    const result = simplify(doc) as Serialization.SerializedObject[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      x: 1,
      y: { __id__: 1 },
      z: { __id__: 1 },
    });
    expect(result[1]).toEqual({ nested: true });
  });

  it('handles deeply nested shared references', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: { __id__: 1 }, b: { __id__: 2 } },
      { inner: { __id__: 2 } },
      { value: 'deep' },
    ];
    const result = simplify(doc) as Serialization.SerializedObject[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      a: { inner: { __id__: 1 } },
      b: { __id__: 1 },
    });
    expect(result[1]).toEqual({ value: 'deep' });
  });

  it('handles numeric zero correctly', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: 0, b: { __id__: 1 } },
      { val: '' },
    ];
    expect(simplify(doc)).toEqual([{ a: 0, b: { val: '' } }]);
  });

  it('handles an object with a property that is an empty object', () => {
    const obj: Serialization.SerializedObject = { a: {} };
    expect(simplify(obj)).toEqual([{ a: {} }]);
  });

  it('handles the same shared value referenced from multiple levels', () => {
    const doc: Serialization.SerializedObject[] = [
      { direct: { __id__: 1 }, nested: { inner: { __id__: 1 } } },
      { target: 'shared' },
    ];
    const result = simplify(doc) as Serialization.SerializedObject[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      direct: { __id__: 1 },
      nested: { inner: { __id__: 1 } },
    });
    expect(result[1]).toEqual({ target: 'shared' });
  });

  it('handles arrays as values within objects', () => {
    const doc: Serialization.SerializedObject[] = [
      { items: { __id__: 1 }, copy: { __id__: 1 } },
      [1, 2, 3] as unknown as Serialization.SerializedObject,
    ];
    const result = simplify(doc) as Serialization.SerializedObject[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ items: { __id__: 1 }, copy: { __id__: 1 } });
    expect(result[1]).toEqual([1, 2, 3]);
  });

  it('inlines arrays referenced only once', () => {
    const doc: Serialization.SerializedObject[] = [
      { items: { __id__: 1 } },
      [4, 5, 6] as unknown as Serialization.SerializedObject,
    ];
    expect(simplify(doc)).toEqual([{ items: [4, 5, 6] }]);
  });

  it('handle ref of ref', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: { __id__: 1 } },
      { __id__: 2 },
      { c: 42 },
    ];
    expect(simplify(doc)).toEqual(
      [{ a: { c: 42 } }],
    );
  });

  it('throw error in circular ref of ref', () => {
    const doc: Serialization.SerializedObject[] = [
      { a: { __id__: 1 } },
      { __id__: 2 },
      { __id__: 1 },
    ];
    expect(() => simplify(doc)).toThrow('Maximum call stack size exceeded');
  });
});
