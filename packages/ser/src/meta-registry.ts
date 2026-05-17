import type { SerProtocol } from './protocol.js';

export interface ClassMeta<T, TIntermediates = never> {
  /**
   * Class ID.
   */
  id: string;

  /**
   * Field metadata.
   */
  fields?: Record<string, FieldMeta>;

  /**
   * Custom serialization functions.
   */
  custom?: ClassCustomSerialization<T, TIntermediates>;

  /**
   * Serialize each occurrence of this class as an independent value, even when
   * multiple fields point to the same runtime object.
   */
  nonShared?: true;
}

export interface ClassCustomSerialization<T, TIntermediates = never> {
  encode: (ctx: SerializeContext, value: T) => TIntermediates;
  decode?: (ctx: DeserializeContext, input: TIntermediates) => T;
  decodeInto?: (ctx: DeserializeContext, input: TIntermediates, target: T) => void;
}

export interface FieldTypeInlineSpecification {
  [key: string]: FieldTypeSpecification;
}

export type FieldTypeSpecification = (new (...args: any[]) => any) | FieldTypeInlineSpecification;

export interface FieldMeta {
  type?: FieldTypeSpecification;
  array?: false | {
    type: FieldTypeSpecification;
  };
  fixed?: true;
}

const classMetaRegistry = new WeakMap<(new (...args: any[]) => any), ClassMeta<any, any>>();
const classMetaRegistryById = new Map<string, RegisteredClassMeta<any, any>>();

export interface RegisteredClassMeta<T, TIntermediates = never> {
  constructor: new (...args: any[]) => T;
  meta: ClassMeta<T, TIntermediates>;
}

export interface ClassMetaRegisterOptions<T, TIntermediates> {
  id: string;
  fields?: (keyof T | [keyof T, FieldMeta])[];
  custom?: ClassCustomSerialization<T, TIntermediates>;
  nonShared?: true;
}

export function registerClassMeta<T, TIntermediates>(constructor: new (...args: any[]) => T, meta: ClassMetaRegisterOptions<T, TIntermediates>) {
  const classMeta: ClassMeta<T, TIntermediates> = {
    ...meta,
    fields: meta.fields ? normalizeFields(meta.fields) : undefined,
  };
  classMetaRegistry.set(constructor, classMeta);
  classMetaRegistryById.set(meta.id, {
    constructor,
    meta: classMeta,
  });
}

export function getClassMeta<T, TIntermediates>(constructor: new (...args: any[]) => T): ClassMeta<T, TIntermediates> {
  return classMetaRegistry.get(constructor) as ClassMeta<T, TIntermediates>;
}

export function getClassMetaById<T, TIntermediates>(id: string): RegisteredClassMeta<T, TIntermediates> | undefined {
  return classMetaRegistryById.get(id) as RegisteredClassMeta<T, TIntermediates> | undefined;
}

function normalizeFields<T>(fields: (keyof T | [keyof T, FieldMeta])[]): Record<string, FieldMeta> {
  const result: Record<string, FieldMeta> = {};
  for (const field of fields) {
    if (Array.isArray(field)) {
      result[String(field[0])] = field[1];
    } else {
      result[String(field)] = {};
    }
  }
  return result;
}

export type SerializeContext = SerProtocol.SerializeContext;
export type DeserializeContext = SerProtocol.DeserializeContext;
