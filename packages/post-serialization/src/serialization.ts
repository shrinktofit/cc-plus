import { simplify } from './simplification.js';

declare namespace Serialization {
  export type SerializedPrimitive = number | string | boolean | null;
  export type SerializedArray = Value[];
  export type SerializedObject = SerializedTypedObject | SerializedPlainObject;
  export type SerializedTypedObject = {
    __type__: string;
    [x: string]: Value;
  };
  export type SerializedPlainObject = {
    [x: string]: Value;
  };
  export type SerializedReference = {
    __id__: number;
  };
  export type Value = SerializedPrimitive | SerializedArray | SerializedObject | SerializedReference;
  export type SerializedDocument = SerializedPrimitive | SerializedObject | SerializedObject[];
  export type ShareableValue = SerializedObject | SerializedArray;
}

export function isSerializedReference(value: unknown): value is Serialization.SerializedReference {
  return typeof value === 'object' && !!value && '__id__' in value && typeof value.__id__ === 'number';
}

export function isTypedObject(value: unknown): value is Serialization.SerializedTypedObject {
  return typeof value === 'object' && !!value && '__type__' in value && typeof value.__type__ === 'string';
}

export type { Serialization };

declare global {
  export namespace EditorExtends {
    export interface SerializeParserOptions {
      // 是否压缩 uuid
      compressUuid?: boolean;
      discardInvalid?: boolean;
      dontStripDefault?: boolean;
      missingClassReporter?: any;
      missingObjectReporter?: any;
      reserveContentsForSyncablePrefab?: boolean;
      // 是否构建，取决于 builder
      _exporting?: boolean;
      useCCON?: boolean;
      // 是否保留节点、组件 uuid 数据
      keepNodeUuid?: boolean;
      recordAssetDepends?: string[];
    }

    export interface SerializeBuilderOptions {
      builder?: 'dynamic' | 'compiled';
      /** @default true */
      stringify?: boolean;
      /** @default false */
      minify?: boolean;
      /** @default true */
      noNativeDep?: boolean;
      // 强制内联所有数据，不要出现 __id__，简化解析逻辑，如不支持将会抛出异常
      // 启用后，如果多处引用相同对象，序列化结果将会不准确；如果出现循环引用，JSON.stringify 时将会出错
      forceInline?: boolean;
      /** @default false */
      useCCON?: boolean;
    }

    export function serialize(value: unknown, opts?: SerializeBuilderOptions & SerializeParserOptions): Serialization.SerializedDocument;
  }
}

export function serialize(value: unknown) {
  const serialized1 = EditorExtends.serialize(value, {
    stringify: false,
    dontStripDefault: false,
    _exporting: true,
  });
  const simplified = simplify(serialized1);
  return simplified;
}
