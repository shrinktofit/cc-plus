import './cc-types/register.js';
import { registerClassMeta } from './meta-registry.js';

registerClassMeta(BigInt as unknown as new () => bigint, {
  id: 'es.BigInt',
  custom: {
    encode: (_, value) => value.toString(),
    decode: (_, input) => BigInt(input),
  },
});

registerClassMeta(Date, {
  id: 'es.Date',
  custom: {
    encode: (_, value) => value.getTime(),
    decodeInto: (_, input, target) => {
      target.setTime(input);
    },
  },
});

registerClassMeta(Map, {
  id: 'es.Map',
  custom: {
    encode: (_, value) => Array.from(value.entries()),
    decodeInto: (_, input, target) => {
      target.clear();
      for (const [key, value] of input) {
        target.set(key, value);
      }
    },
  },
});

registerClassMeta(Set, {
  id: 'es.Set',
  custom: {
    encode: (_, value) => Array.from(value.values()),
    decodeInto: (_, input, target) => {
      target.clear();
      for (const value of input) {
        target.add(value);
      }
    },
  },
});

registerClassMeta(RegExp, {
  id: 'es.RegExp',
  custom: {
    encode: (_, value) => ({
      source: value.source,
      flags: value.flags,
    }),
    decode: (_, input) => new RegExp(input.source, input.flags),
  },
});

registerArrayBufferViewMeta(Int8Array, 'es.Int8Array');
registerArrayBufferViewMeta(Uint8Array, 'es.Uint8Array');
registerArrayBufferViewMeta(Uint8ClampedArray, 'es.Uint8ClampedArray');
registerArrayBufferViewMeta(Int16Array, 'es.Int16Array');
registerArrayBufferViewMeta(Uint16Array, 'es.Uint16Array');
registerArrayBufferViewMeta(Int32Array, 'es.Int32Array');
registerArrayBufferViewMeta(Uint32Array, 'es.Uint32Array');
registerArrayBufferViewMeta(Float32Array, 'es.Float32Array');
registerArrayBufferViewMeta(Float64Array, 'es.Float64Array');
registerArrayBufferViewMeta(BigInt64Array, 'es.BigInt64Array', true);
registerArrayBufferViewMeta(BigUint64Array, 'es.BigUint64Array', true);

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

type TypedArrayElement<T extends TypedArray> = T extends BigInt64Array | BigUint64Array ? bigint : number;
type TypedArrayConstructor<T extends TypedArray> = new (values: ArrayLike<TypedArrayElement<T>>) => T;
type SerializedTypedArrayElement<T extends TypedArray> = T extends BigInt64Array | BigUint64Array ? number | string : number;

function registerArrayBufferViewMeta<T extends TypedArray>(constructor: TypedArrayConstructor<T>, id: string, bigintElements = false) {
  registerClassMeta<T, Array<SerializedTypedArrayElement<T>>>(constructor, {
    id,
    custom: {
      encode: (_, value) => Array.from(value as unknown as ArrayLike<TypedArrayElement<T>>, (element) => {
        if (!bigintElements) {
          return element as SerializedTypedArrayElement<T>;
        }
        return serializeBigIntTypedArrayElement(element as bigint) as SerializedTypedArrayElement<T>;
      }),
      decode: (_, input) => new constructor(
        bigintElements
          ? input.map((element) => BigInt(element)) as Array<TypedArrayElement<T>>
          : input as Array<TypedArrayElement<T>>,
      ),
    },
  });
}

function serializeBigIntTypedArrayElement(value: bigint) {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
}
