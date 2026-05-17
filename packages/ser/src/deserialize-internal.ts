import './register-builtin-meta.js';
import invariant from 'tiny-invariant';
import { getClassMeta, getClassMetaById, type DeserializeContext, type FieldMeta } from './meta-registry.js';
import { SerProtocol } from './protocol.js';

interface SharedValueInfo {
  source: SerProtocol.ShareableValue;
  target?: unknown;
  populated: boolean;
}

class DeserializeInternalContext {
  constructor(document: SerProtocol.Document) {
    this._sharedValues = document.sharedValues?.map((source) => ({
      source,
      populated: false,
    })) ?? [];
  }

  deserializeValue(value: SerProtocol.Value, fieldMeta?: FieldMeta, fixedRuntimeValue?: unknown): unknown {
    if (fieldMeta?.fixed) {
      return this._deserializeFixedValue(value, fieldMeta, fixedRuntimeValue);
    }

    if (!isObject(value)) {
      return value;
    }

    if (isRef(value)) {
      return this._deserializeSharedValue(value.$);
    }

    if (isTypedObject(value) && isIntrinsicValue(value.$)) {
      return deserializeIntrinsicValue(value.$);
    }

    return this._deserializeShareableValue(value);
  }

  private _deserializeFixedValue(value: SerProtocol.Value, fieldMeta: FieldMeta, fixedRuntimeValue: unknown): unknown {
    if (fieldMeta.array) {
      return this._deserializeFixedArrayValue(value, fieldMeta, fixedRuntimeValue);
    }

    const constructor = getFixedFieldConstructorFromRuntimeValue(fixedRuntimeValue);
    const meta = getClassMeta(constructor);
    invariant(meta, 'Fixed field type must be registered');

    const custom = meta.custom;
    if (custom || isInstanceDeserializable(fixedRuntimeValue)) {
      const input = this.deserializeValue(value) as never;
      if (custom?.decode) {
        return custom.decode(deserializeContext, input);
      }
      const target = new constructor();
      this._decodeIntoTarget(meta.id, custom, target, input);
      return target;
    }

    if (!isObject(value)) {
      return value;
    }

    if (isRef(value)) {
      return this._deserializeSharedValue(value.$, constructor);
    }

    const target = isCustomTypedObject(value) && !usesCustomTypedObject(constructor, meta)
      ? this._createRegisteredTarget(constructor, getSerializedConstructorParameters(value))
      : new constructor();
    const fieldsSource = isCustomTypedObject(value)
      ? omitTypeField(value)
      : value;
    this._populateObjectFields(fieldsSource, target, meta.fields);
    return target;
  }

  private _deserializeFixedArrayValue(value: SerProtocol.Value, fieldMeta: FieldMeta, fixedRuntimeValue: unknown): unknown {
    invariant(Array.isArray(fixedRuntimeValue), 'Fixed array field must have an array runtime value');
    invariant(Array.isArray(value), 'Fixed array field serialized value must be an array');
    const elementConstructor = getFixedArrayElementConstructor(fieldMeta);
    const result = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      result[i] = this._deserializeFixedValue(value[i], {
        fixed: true,
      }, new elementConstructor());
    }
    return result;
  }

  private _deserializeSharedValue(index: number, fixedConstructor?: new (...args: any[]) => any): unknown {
    const info = this._sharedValues[index];
    invariant(info, `Unknown shared value reference: ${index}`);

    if (info.populated) {
      return info.target;
    }

    if (!info.target) {
      info.target = this._createTarget(info.source, fixedConstructor);
    }

    info.populated = true;
    const populatedTarget = this._populateTarget(info.source, info.target, fixedConstructor);
    if (populatedTarget !== undefined) {
      info.target = populatedTarget;
    }
    return info.target;
  }

  private _deserializeShareableValue(value: SerProtocol.ShareableValue): unknown {
    const target = this._createTarget(value);
    const populatedTarget = this._populateTarget(value, target);
    return populatedTarget ?? target;
  }

  private _createTarget(value: SerProtocol.ShareableValue, fixedConstructor?: new (...args: any[]) => any): unknown {
    if (Array.isArray(value)) {
      return new Array(value.length);
    }

    if (fixedConstructor) {
      return new fixedConstructor();
    }

    if (isCustomTypedObject(value)) {
      const registered = getClassMetaById(value.$[0]);
      invariant(registered, `Unknown type id: ${value.$[0]}`);
      if (usesCustomTypedObject(registered.constructor, registered.meta)) {
        if (registered.meta.custom?.decode) {
          return undefined;
        }
        return new registered.constructor();
      }
      return this._createRegisteredTarget(registered.constructor, getSerializedConstructorParameters(value));
    }

    if (isTypedObject(value)) {
      const registered = getClassMetaById(value.$);
      if (!registered && isIntrinsicValue(value.$)) {
        return deserializeIntrinsicValue(value.$);
      }
      invariant(registered, `Unknown type id: ${value.$}`);
      return new registered.constructor();
    }

    return {};
  }

  private _populateTarget(source: SerProtocol.ShareableValue, target: unknown, fixedConstructor?: new (...args: any[]) => any): unknown {
    if (Array.isArray(source)) {
      invariant(Array.isArray(target));
      for (let i = 0; i < source.length; i++) {
        target[i] = this.deserializeValue(source[i]);
      }
      return;
    }

    if (fixedConstructor) {
      const meta = getClassMeta(fixedConstructor);
      invariant(meta, 'Fixed field type must be registered');
      this._populateObjectFields(source, target, meta.fields);
      return;
    }

    if (isCustomTypedObject(source)) {
      const registered = getClassMetaById(source.$[0]);
      invariant(registered, `Unknown type id: ${source.$[0]}`);
      if (!usesCustomTypedObject(registered.constructor, registered.meta)) {
        const fieldsSource = omitTypeField(source);
        this._populateObjectFields(fieldsSource, target, registered.meta.fields);
        return;
      }

      const custom = registered.meta.custom;
      const input = this.deserializeValue(source.$[1]) as never;
      if (custom?.decode) {
        return custom.decode(deserializeContext, input);
      }
      this._decodeIntoTarget(source.$[0], custom, target, input);
      return;
    }

    const fieldsSource = isTypedObject(source)
      ? omitTypeField(source)
      : source;
    const fieldsMeta = isTypedObject(source)
      ? getClassMetaById(source.$)?.meta.fields
      : undefined;
    this._populateObjectFields(fieldsSource, target, fieldsMeta);
  }

  private _populateObjectFields(source: object, target: unknown, fieldsMeta?: Record<string, FieldMeta>) {
    for (const [key, value] of Object.entries(source)) {
      const targetRecord = target as Record<string, unknown>;
      targetRecord[key] = this.deserializeValue(value as SerProtocol.Value, fieldsMeta?.[key], targetRecord[key]);
    }
  }

  private _createRegisteredTarget(constructor: new (...args: any[]) => any, serializedParameters: SerProtocol.Value[]) {
    const parameters = serializedParameters.map((parameter) => this.deserializeValue(parameter));
    return new constructor(...parameters);
  }

  private _decodeIntoTarget(typeId: string, custom: { decodeInto?: (ctx: DeserializeContext, input: never, target: never) => void } | undefined, target: unknown, input: never) {
    if (custom?.decodeInto) {
      custom.decodeInto(deserializeContext, input, target as never);
      return;
    }

    invariant(isInstanceDeserializable(target), `Type ${typeId} does not support custom deserialization`);
    target[SerProtocol.deserializeInto](deserializeContext, input);
  }

  private readonly _sharedValues: SharedValueInfo[];
}

const deserializeContext: DeserializeContext = {};

export function deserialize(document: SerProtocol.Document): unknown {
  if (document.version !== SerProtocol.VERSION) {
    throw new Error(`Unsupported ser protocol version: ${document.version}`);
  }

  const ctx = new DeserializeInternalContext(document);
  return ctx.deserializeValue(document.value);
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isRef(value: object): value is SerProtocol.Ref {
  return typeof (value as { $?: unknown }).$ === 'number';
}

function isTypedObject(value: object): value is SerProtocol.TypedObject & { $: string } {
  return typeof (value as { $?: unknown }).$ === 'string';
}

function isCustomTypedObject(value: object): value is SerProtocol.TypedObject & { $: [string, ...SerProtocol.Value[]] } {
  const typeInfo = (value as { $?: unknown }).$;
  return Array.isArray(typeInfo) && typeof typeInfo[0] === 'string';
}

function getSerializedConstructorParameters(value: SerProtocol.TypedObject & { $: [string, ...SerProtocol.Value[]] }): SerProtocol.Value[] {
  return value.$.slice(1) as SerProtocol.Value[];
}

function omitTypeField(value: SerProtocol.TypedObject): Record<string, SerProtocol.Value> {
  const {
    $,
    ...fields
  } = value;
  return fields;
}

function getFixedFieldConstructorFromRuntimeValue(value: unknown): new (...args: any[]) => any {
  invariant(isObject(value), 'Fixed field must have an object runtime value');
  const constructor = Object.getPrototypeOf(value)?.constructor;
  invariant(typeof constructor === 'function', 'Fixed field runtime value must have a constructor');
  return constructor;
}

function getFixedArrayElementConstructor(fieldMeta: FieldMeta): new (...args: any[]) => any {
  invariant(fieldMeta.array, 'Fixed array field must specify array metadata');
  invariant(typeof fieldMeta.array.type === 'function', 'Fixed array field element type must be a constructor');
  return fieldMeta.array.type;
}

function deserializeIntrinsicValue(id: string): unknown {
  switch (id) {
  case 'intrinsic.nan':
    return NaN;
  case 'intrinsic.inf':
    return Infinity;
  case 'intrinsic.-inf':
    return -Infinity;
  default:
    throw new Error(`Unknown type id: ${id}`);
  }
}

function isIntrinsicValue(id: string) {
  return id === 'intrinsic.nan'
    || id === 'intrinsic.inf'
    || id === 'intrinsic.-inf';
}

function isInstanceDeserializable(value: unknown): value is object & Required<Pick<SerProtocol.Serializable<any, any>, typeof SerProtocol.deserializeInto>> {
  return isObject(value) && typeof (value as Partial<SerProtocol.Serializable<any, any>>)[SerProtocol.deserializeInto] === 'function';
}

function usesCustomTypedObject(constructor: new (...args: any[]) => any, meta: { custom?: unknown }) {
  return !!meta.custom || typeof constructor.prototype?.[SerProtocol.deserializeInto] === 'function';
}
