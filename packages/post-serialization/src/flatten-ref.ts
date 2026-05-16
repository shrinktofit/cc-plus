import invariant from 'tiny-invariant';
import { isSerializedReference, type Serialization } from './serialization.js';

export function flattenRef(serialized: DerefSpace.Value) {
  if (typeof serialized !== 'object' || !serialized) {
    return serialized;
  }

  const refCountContext = countRefs(serialized);
  return new FlattenContext(refCountContext).exec(serialized);
}

class FlattenContext {
  constructor(readonly refCountContext: CountContext) {
  }

  exec(root: DerefSpace.Value) {
    const flattenRoot = this._flatten(root, true);
    for (; this._queue.length > 0;) {
      const value = this._queue.shift()!;
      const record = this._shareableValueRecords.get(value);
      invariant(record);
      const output = this._flattenImmediate(value);
      this._shareableValues[record.ref.__id__] = output;
    }
    if (this._shareableValues.length === 0) {
      return flattenRoot;
    }
    invariant(isSerializedReference(flattenRoot) && flattenRoot.__id__ === 0);
    return this._shareableValues;
  }

  private _shareableValues: Array<Serialization.Value> = [];

  private _shareableValueRecords = new Map<DerefSpace.ShareableValue, {
    ref: { __id__: number };
  }>();

  private _queue: Array<DerefSpace.ShareableValue> = [];

  private _flattenImmediate(value: DerefSpace.ShareableValue): Serialization.Value {
    if (Array.isArray(value)) {
      return value.map((item) => this._flatten(item, false));
    }

    {
      const result: Serialization.SerializedObject = {};
      for (const key of Object.keys(value)) {
        result[key] = this._flatten(value[key as keyof typeof value], false);
      }
      return result;
    }
  }

  private _flatten(value: DerefSpace.Value, isRoot: boolean) {
    if (typeof value !== 'object' || !value) {
      return value;
    }

    const existingRecord = this._shareableValueRecords.get(value);
    if (existingRecord) {
      return existingRecord.ref;
    }

    if (!isRoot && this.refCountContext.getRefCount(value) < 2) {
      return this._flattenImmediate(value);
    }

    const shareableValueId = this._shareableValues.length;
    this._shareableValues.push(undefined!);
    const record = {
      ref: Object.freeze({ __id__: shareableValueId }),
    };
    this._shareableValueRecords.set(value, record);
    this._queue.push(value);
    return record.ref;
  }
}

function countRefs(value: DerefSpace.Value) {
  const ctx = new CountContext();
  countValueRefs(ctx, value);
  return ctx;
}

function countValueRefs(ctx: CountContext, value: DerefSpace.Value) {
  if (typeof value !== 'object' || !value) {
    return;
  }
  ctx.addRefCount(value);

  if (ctx.counts.has(value)) {
    return;
  }
  ctx.counts.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => {
      countValueRefs(ctx, item);
    });
    return;
  }
  for (const key of Object.keys(value)) {
    countValueRefs(ctx, value[key as keyof typeof value]);
  }
}

class CountContext {
  constructor() {
  }

  readonly counts = new Set<DerefSpace.ShareableValue>();

  readonly refCounts = new Map<DerefSpace.ShareableValue, number>();

  addRefCount(value: DerefSpace.ShareableValue) {
    this.refCounts.set(value, (this.refCounts.get(value) ?? 0) + 1);
  }

  getRefCount(value: DerefSpace.ShareableValue) {
    return this.refCounts.get(value) ?? 0;
  }
}

export declare namespace DerefSpace {
  export type Primitive = number | string | boolean | null;
  export type XArray = Value[];
  export type XObject = TypedObject | PlainObject;
  export type TypedObject = {
    __type__: string;
    [x: string]: Value;
  };
  export type PlainObject = {
    [x: string]: Value;
  };
  export type Value = Primitive | XArray | XObject;
  export type ShareableValue = XObject | XArray;
}

class DerefContext {
  constructor(public document: Serialization.SerializedObject[]) {
    this._table = new Array(this.document.length).fill(undefined);
  }

  getMapping(id: number) {
    return this._table[id];
  }

  setMapping(id: number, value: DerefSpace.XArray | DerefSpace.XObject | undefined) {
    this._table[id] = value;
  }

  private _table: (DerefSpace.XArray | DerefSpace.XObject | undefined)[];
}

export function deref(document: Serialization.SerializedDocument) {
  if (typeof document !== 'object' || !document) {
    return document;
  }
  const sharedValues = Array.isArray(document) ? document : [document];
  const ctx = new DerefContext(sharedValues);
  const dereferencedDocument = derefValue(ctx, sharedValues[0], 0);
  return dereferencedDocument;
}

function derefValue(ctx: DerefContext, input: Serialization.Value, index: number | undefined): DerefSpace.Value {
  if (typeof input !== 'object' || !input) {
    return input;
  }

  if (index !== undefined) {
    const existingMapping = ctx.getMapping(index);
    if (existingMapping) {
      return existingMapping;
    }
  }

  if (Array.isArray(input)) {
    const output = new Array(input.length);
    if (index !== undefined) {
      ctx.setMapping(index, output);
    }
    input.forEach((item, index) => {
      output[index] = derefValue(ctx, item, undefined);
    });
    return output;
  }
  if ('__id__' in input && typeof input.__id__ === 'number') {
    const id = input.__id__;
    return derefValue(ctx, ctx.document[id], id);
  }
  {
    const output: DerefSpace.XObject = {};
    if (index !== undefined) {
      ctx.setMapping(index, output);
    }
    for (const key of Object.keys(input)) {
      output[key] = derefValue(ctx, input[key as keyof typeof input], undefined);
    }
    return output;
  }
}
