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
  countCtx.refCounts[0] = 2;
  countProperty(countCtx, sharedValues[0]);

  const ctx = new SimplifyContext(sharedValues, countCtx.refCounts);
  const nNewSharedValues = ctx.refMap.reduce((acc, refIndex) => acc + (refIndex < 0 ? 0 : 1), 0);
  const newSharedValues = new Array<Serialization.Value>(nNewSharedValues);
  let iRef = 0;
  for (let i = 0; i < sharedValues.length; ++i) {
    if (ctx.refMap[i] >= 0) {
      newSharedValues[iRef++] = simplifyProperty(ctx, sharedValues[i]);
    }
  }
  invariant(iRef === nNewSharedValues);
  return newSharedValues;
}

class CountContext {
  constructor(readonly sharedValues: Serialization.ShareableValue[]) {
    this.refCounts = new Array<number>(this.sharedValues.length).fill(0);
  }

  readonly visited = new Set<Serialization.ShareableValue>();

  readonly refCounts: number[];
}

function countShareableValue(ctx: CountContext, value: Serialization.ShareableValue) {
  if (ctx.visited.has(value)) {
    return;
  }
  ctx.visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => countProperty(ctx, item));
    return;
  }

  {
    for (const key of Object.keys(value)) {
      countProperty(ctx, value[key as keyof typeof value]);
    }
  }
}

function countProperty(ctx: CountContext, value: Serialization.Value) {
  if (typeof value !== 'object' || !value) {
    return;
  }

  if (isSerializedReference(value)) {
    const id = value.__id__;
    ++ctx.refCounts[id];
    countShareableValue(ctx, ctx.sharedValues[id]);
    return;
  }

  countShareableValue(ctx, value);
}

class SimplifyContext {
  constructor(readonly sharedValues: Serialization.ShareableValue[], refCounts: readonly number[]) {
    this.refMap = new Array<number>(this.sharedValues.length).fill(-1);
    let nextId = 0;
    for (let i = 0; i < this.sharedValues.length; ++i) {
      if (refCounts[i] > 1) {
        this.refMap[i] = nextId++;
      }
    }
  }

  readonly refMap: number[];
}

function simplifyShareableValue(ctx: SimplifyContext, value: Serialization.ShareableValue): Serialization.ShareableValue {
  if (Array.isArray(value)) {
    return value.map((item) => simplifyProperty(ctx, item));
  }

  {
    const output: Record<string, Serialization.Value> = {};
    for (const key of Object.keys(value)) {
      output[key] = simplifyProperty(ctx, value[key as keyof typeof value]);
    }
    return output;
  }
}

function simplifyProperty(ctx: SimplifyContext, value: Serialization.Value) {
  if (typeof value !== 'object' || !value) {
    return value;
  }

  if (isSerializedReference(value)) {
    const id = value.__id__;
    const refIndex = ctx.refMap[id];
    if (refIndex < 0) {
      return simplifyProperty(ctx, ctx.sharedValues[id]);
    }
    return { __id__: refIndex };
  }

  return simplifyShareableValue(ctx, value);
}
