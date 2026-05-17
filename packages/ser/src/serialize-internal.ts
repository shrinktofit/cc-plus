import { CCClass } from 'cc';
import { getClassMeta, type SerializeContext } from './meta-registry.js';
import { SerProtocol } from './protocol.js';
import invariant from 'tiny-invariant';

type CircularValue = SerProtocol.PrimitiveValue | SerProtocol.ShareableValue;

export interface SerializeOptions {
  /**
   * What assumptions to make about the underlying format?
   * @default 'json'
   * @see SerializationAssumption
   */
  assumptions?: SerializationAssumptionPreset | SerializationAssumptions;
}

enum SerializationAssumption {
  /**
   * Assumes the underlying format supports full IEEE 754 floating-point format(eg. Infinity, NaN).
   */
  ieee754 = 1 << 0,
}

export type SerializationAssumptionPreset = 'json' | 'json5' | 'yaml';

export interface SerializationAssumptions {
  /**
   * The backing format can represent NaN, Infinity and -Infinity directly.
   */
  ieee754?: boolean;
}

export const serializationAssumptionPresets = {
  json: 0,
  json5: SerializationAssumption.ieee754,
  yaml: SerializationAssumption.ieee754,
} as const satisfies Record<SerializationAssumptionPreset, number>;

class SerializeInternalContext {
  assumptions = 0;

  finalize(root: CircularValue) {
    const finalizeContext: FinalizeContext = {
      sharedValues: [],
      sharedValueRefInfos: new Map(),
      nextRefIndex: 0,
    };
    this._countRefs(finalizeContext, root);
    const value = this._finalizeProperty(finalizeContext, root);
    return {
      root: value,
      sharedValues: finalizeContext.sharedValues as SerProtocol.ShareableValue[],
    };
  }

  addSerializingSharedValue(original: object) {
    this._sharedValues.set(original, null);
  }

  addSharedValue(original: object, value: SerProtocol.ShareableValue) {
    this._sharedValues.set(original, value);
  }

  removeSharedValue(original: object) {
    this._sharedValues.delete(original);
  }

  getSharedValue(original: object) {
    if (!this._sharedValues.has(original)) {
      return undefined;
    }

    const sharedValue = this._sharedValues.get(original);
    if (sharedValue === null) {
      throw new Error('Circular reference in constructor parameters is not supported');
    }

    if (sharedValue) {
      return sharedValue;
    }
    return undefined;
  }

  private _sharedValues: Map<object, SerProtocol.ShareableValue | null> = new Map();

  private _countRefs(ctx: FinalizeContext, value: CircularValue) {
    if (typeof value !== 'object' || !value) {
      return;
    }

    let refInfo = ctx.sharedValueRefInfos.get(value);
    if (refInfo) {
      ++refInfo.refs;
      if (refInfo.refs === 2) {
        refInfo.refIndex = ctx.nextRefIndex++;
      }
      return;
    }

    refInfo = { refs: 1, refIndex: -1, finalized: false };
    ctx.sharedValueRefInfos.set(value, refInfo);
    for (const propValue of Object.values(value)) {
      this._countRefs(ctx, propValue);
    }
  }

  private _finalizeShareableValue(ctx: FinalizeContext, value: SerProtocol.ShareableValue): SerProtocol.ShareableValue {
    if (Array.isArray(value)) {
      const result = new Array(value.length);
      for (let i = 0; i < value.length; ++i) {
        result[i] = this._finalizeProperty(ctx, value[i] as CircularValue);
      }
      return result;
    } else {
      const result: Record<string, SerProtocol.Value> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this._finalizeProperty(ctx, v as CircularValue);
      }
      return result;
    }
  }

  private _finalizeProperty(ctx: FinalizeContext, propValue: CircularValue): SerProtocol.Value {
    if (typeof propValue !== 'object' || !propValue) {
      return propValue;
    }

    const refInfo = ctx.sharedValueRefInfos.get(propValue);
    invariant(refInfo);

    if (refInfo.refIndex < 0) {
      return this._finalizeShareableValue(ctx, propValue);
    }

    if (!refInfo.finalized) {
      refInfo.finalized = true;
      ctx.sharedValues[refInfo.refIndex] = this._finalizeShareableValue(ctx, propValue);
    }

    return {
      $: refInfo.refIndex,
    } as SerProtocol.Ref;
  }
}

interface FinalizeContext {
  sharedValues: (SerProtocol.ShareableValue | undefined)[];
  sharedValueRefInfos: Map<SerProtocol.ShareableValue, { refs: number; refIndex: number; finalized: boolean }>;
  nextRefIndex: number;
}

const serializeContext: SerializeContext = {};

export function serialize(value: unknown, opts?: SerializeOptions): SerProtocol.Document {
  const ctx = new SerializeInternalContext();
  ctx.assumptions = resolveSerializationAssumptions(opts?.assumptions);

  const result = serializeValue(ctx, value);

  const { root, sharedValues } = ctx.finalize(result);

  const document: SerProtocol.Document = {
    version: SerProtocol.VERSION,
    value: root,
  };
  if (sharedValues.length > 0) {
    document.sharedValues = sharedValues;
  }
  return document;
}

function serializeValue(ctx: SerializeInternalContext, value: unknown, knownType?: boolean): CircularValue {
  switch (typeof value) {
  case 'string':
  case 'boolean':
    return value;
  case 'number':
    return serializeNumber(ctx, value);
  case 'bigint':
    return {
      $: ['es.BigInt', value.toString()],
    } as SerProtocol.CustomTypedObject;
  case 'object': {
    if (!value) {
      return value;
    }
    return serializeShareable(ctx, value, knownType);
  }
  case 'undefined':
    return value;
  default:
    throw new Error(`Unknown type: ${typeof value}`);
  }
}

function serializeNumber(ctx: SerializeInternalContext, value: number): CircularValue {
  if (Number.isNaN(value)) {
    return hasAssumption(ctx, SerializationAssumption.ieee754)
      ? value
      : {
        $: 'intrinsic.nan',
      };
  }

  if (value === Infinity) {
    return hasAssumption(ctx, SerializationAssumption.ieee754)
      ? value
      : {
        $: 'intrinsic.inf',
      };
  }

  if (value === -Infinity) {
    return hasAssumption(ctx, SerializationAssumption.ieee754)
      ? value
      : {
        $: 'intrinsic.-inf',
      };
  }

  return value;
}

function hasAssumption(ctx: SerializeInternalContext, assumption: SerializationAssumption) {
  return (ctx.assumptions & assumption) !== 0;
}

function resolveSerializationAssumptions(assumptions: SerializeOptions['assumptions'] = 'json') {
  if (typeof assumptions === 'string') {
    const preset = serializationAssumptionPresets[assumptions];
    if (preset === undefined) {
      throw new Error(`Unknown assumptions preset: ${assumptions}`);
    }
    return preset;
  }

  let result = 0;
  if (assumptions.ieee754) {
    result |= SerializationAssumption.ieee754;
  }
  return result;
}

function serializeShareable(ctx: SerializeInternalContext, value: object, knownType?: boolean): CircularValue {
  const useSharedValue = !knownType && shouldUseSharedValue(value);
  if (useSharedValue) {
    const sharedValue = ctx.getSharedValue(value);
    if (sharedValue) {
      return sharedValue;
    }
  }

  if (Array.isArray(value)) {
    const arr = new Array<SerProtocol.Value>(value.length);
    ctx.addSharedValue(value, arr);
    for (let i = 0; i < value.length; i++) {
      arr[i] = serializeValue(ctx, value[i], knownType);
    }
    return arr;
  }

  return serializeObject(ctx, value as object, knownType, useSharedValue);
}

function serializeObject(ctx: SerializeInternalContext, obj: object, knownType?: boolean, useSharedValue = true): CircularValue {
  const objectProto = Object.getPrototypeOf(obj);
  if (!objectProto) {
    // eg. Object.create(null)
    // todo: handle this case
    return {};
  }

  const constructor = objectProto.constructor;
  if (typeof constructor !== 'function') {
    // In most cases, this should not happen, but if it does, we silently ignore it.
    return null;
  }

  // If the object is a plain object(eg. Object literal, or new Object()),
  // we serialize it as a plain object.
  if (constructor === Object) {
    const result: SerProtocol.TypedObject = {};
    ctx.addSharedValue(obj, result);
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue;
      }
      result[key] = serializeValue(ctx, value, false);
    }
    return result;
  }

  // Let's see if the class has meta.
  const meta = getClassMeta(constructor);

  // If the class has no meta,
  // eg. non-registered classes or classes with proto we don't know about.
  // it might be a CC object(i.e. a class that we registered in @ccclass) or not,
  // handle it according to cc's law.
  if (!meta) {
    return trySerializeCCObject(ctx, obj, constructor);
  }

  const custom = meta.custom ?? getInstanceCustomSerialization(obj);
  // If the class has custom handlers, run it.
  if (custom) {
    const encodeResult = encodeCustomObject(custom, obj);
    // Also serialize the result.
    const serializedEncodeResult = serializeValue(ctx, encodeResult, false);
    if (knownType) {
      // If we know the type of the object, we use it directly.
      return serializedEncodeResult;
    } else {
      // Otherwise we must record the type info.
      const result: SerProtocol.CustomTypedObject = {
        $: [meta.id, serializedEncodeResult],
      };
      if (useSharedValue) {
        ctx.addSharedValue(obj, result);
      }
      return result;
    }
  }

  // Otherwise, we do the default serialization.
  const fields = meta.fields;
  const result: SerProtocol.TypedObject = {};
  const constructorParameters = getInstanceConstructorParameters(obj);
  if (constructorParameters) {
    ctx.addSerializingSharedValue(obj);
    const parameters = constructorParameters(serializeContext);
    if (!Array.isArray(parameters)) {
      throw new Error(`Constructor parameters for type ${meta.id} must be an array`);
    }
    result.$ = [
      meta.id,
      ...parameters.map((parameter) => serializeValue(ctx, parameter, false)),
    ];
  } else if (!knownType) {
    result.$ = meta.id;
  }
  if (useSharedValue) {
    ctx.addSharedValue(obj, result);
  }
  if (!fields) {
    if (constructorParameters && !useSharedValue) {
      ctx.removeSharedValue(obj);
    }
    return result;
  }
  for (const [fieldKey, fieldMeta] of Object.entries(fields)) {
    const fieldValue = Reflect.get(obj, fieldKey);
    // Ignore undefined fields.
    if (fieldValue === undefined) {
      continue;
    }
    if (fieldMeta.fixed === true && Array.isArray(fieldValue)) {
      invariant(fieldMeta.array && typeof fieldMeta.array.type === 'function', 'Fixed array field must specify an element type');
    }
    result[fieldKey] = serializeValue(ctx, fieldValue, fieldMeta.fixed === true);
  }
  if (constructorParameters && !useSharedValue) {
    ctx.removeSharedValue(obj);
  }
  return result;
}

function getInstanceCustomSerialization(obj: object) {
  if (!isInstanceSerializable(obj)) {
    return undefined;
  }

  return {
    encode: (ctx: SerializeContext) => obj[SerProtocol.serialize](ctx),
  };
}

function encodeCustomObject(custom: { encode: (ctx: SerializeContext, value: object) => unknown }, obj: object) {
  return custom.encode(serializeContext, obj);
}

function isInstanceSerializable(obj: object): obj is object & Required<Pick<SerProtocol.Serializable<any, any>, typeof SerProtocol.serialize>> {
  return typeof (obj as Partial<SerProtocol.Serializable<any, any>>)[SerProtocol.serialize] === 'function';
}

function getInstanceConstructorParameters(obj: object) {
  if (!isConstructorParameterSerializable(obj)) {
    return undefined;
  }

  return (ctx: SerializeContext) => obj[SerProtocol.constructorParameters](ctx);
}

function isConstructorParameterSerializable(obj: object): obj is object & Required<Pick<SerProtocol.Serializable<any, any>, typeof SerProtocol.constructorParameters>> {
  return typeof (obj as Partial<SerProtocol.Serializable<any, any>>)[SerProtocol.constructorParameters] === 'function';
}

function shouldUseSharedValue(value: object) {
  if (Array.isArray(value)) {
    return true;
  }

  const objectProto = Object.getPrototypeOf(value);
  if (!objectProto) {
    return false;
  }

  const constructor = objectProto.constructor;
  if (typeof constructor !== 'function') {
    return false;
  }

  if (constructor === Object) {
    return true;
  }

  return !getClassMeta(constructor)?.nonShared;
}

function trySerializeCCObject(ctx: SerializeInternalContext, object: object, constructor: Function): CircularValue | null {
  let props: undefined | string[] = undefined;
  const isCCClassOrFastDefined = CCClass.isCCClassOrFastDefined(constructor as new (...args: any[]) => any);
  if (isCCClassOrFastDefined) {
    props = Reflect.get(constructor, '__props__');
  }
  if (!props || !Array.isArray(props)) {
    // This is not a CC object.
    // todo: handle this case
    return null;
  }

  const result: SerProtocol.TypedObject = {};
  ctx.addSharedValue(object, result);
  for (const propKey of props) {
    result[propKey] = serializeValue(ctx, (object as Record<string, unknown>)[propKey], false);
  }
  return result;
}
