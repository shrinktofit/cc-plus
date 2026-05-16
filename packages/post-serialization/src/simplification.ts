import invariant from 'tiny-invariant';
import { isSerializedReference, type Serialization } from './serialization.js';

export function simplify(serialized: Serialization.SerializedDocument) {
  if (typeof serialized !== 'object' || !serialized) {
    return serialized;
  }
  if (Array.isArray(serialized) && serialized.length === 0) {
    return serialized;
  }
  const sharedValues = Array.isArray(serialized) ? serialized : [serialized];

  const countCtx = new CountContext(sharedValues);
  // document itself holds a reference to the root
  ++countCtx.refCounts[0];
  countValue(countCtx, sharedValues[0], 0);

  const ctx = new SimplifyContext(sharedValues, countCtx.refCounts);
  const nNewSharedValues = ctx.refMap.reduce((acc, refIndex) => acc + (refIndex < 0 ? 0 : 1), 0);
  const newSharedValues = new Array(nNewSharedValues);
  let iRef = 0;
  for (let i = 0; i < sharedValues.length; ++i) {
    if (ctx.refMap[i] >= 0) {
      newSharedValues[iRef++] = simplifyValue(ctx, sharedValues[i]);
    }
  }
  invariant(iRef === nNewSharedValues);
  return newSharedValues;
}

class CountContext {
  constructor(readonly sharedValues: Serialization.ShareableValue[]) {
    this.refCounts = new Array(this.sharedValues.length).fill(0);
  }

  readonly visited = new Set<Serialization.ShareableValue>();

  readonly refCounts: Array<number>;
}

function countValue(ctx: CountContext, value: Serialization.Value, refIndex: number | undefined) {
  if (typeof value !== 'object' || !value) {
    return;
  }

  if (refIndex !== undefined) {
    ++ctx.refCounts[refIndex];
  }

  if (ctx.visited.has(value)) {
    return;
  }
  ctx.visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => countValue(ctx, item, undefined));
    return;
  }

  if (isSerializedReference(value)) {
    const id = value.__id__;
    countValue(ctx, ctx.sharedValues[id], id);
    return;
  }

  {
    for (const key of Object.keys(value)) {
      countValue(ctx, value[key as keyof typeof value], undefined);
    }
  }
}

class SimplifyContext {
  constructor(readonly sharedValues: Serialization.ShareableValue[], refCounts: readonly number[]) {
    this.refMap = new Array(this.sharedValues.length).fill(-1);
    let nextId = 0;
    for (let i = 0; i < this.sharedValues.length; ++i) {
      if (refCounts[i] > 1) {
        this.refMap[i] = nextId++;
      }
    }
  }

  readonly refMap: number[];
}

function simplifyValue(ctx: SimplifyContext, value: Serialization.Value): Serialization.Value {
  if (typeof value !== 'object' || !value) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => simplifyValue(ctx, item));
  }

  if (isSerializedReference(value)) {
    const id = value.__id__;
    const refIndex = ctx.refMap[id];
    if (refIndex < 0) {
      return simplifyValue(ctx, ctx.sharedValues[id]);
    }
    return { __id__: refIndex };
  }

  {
    const output: Record<string, Serialization.Value> = {};
    for (const key of Object.keys(value)) {
      output[key] = simplifyValue(ctx, value[key as keyof typeof value]);
    }
    return output;
  }
}
