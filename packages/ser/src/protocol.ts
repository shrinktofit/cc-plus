// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SerProtocol {
  export const VERSION = '202605';
  export const serialize = Symbol.for('cc-plus.ser.serialize');
  export const deserializeInto = Symbol.for('cc-plus.ser.deserializeInto');
  export const constructorParameters = Symbol.for('cc-plus.ser.constructorParameters');

  /**
   * Document that can be serialized and deserialized.
   */
  export interface Document {
    version: typeof VERSION;
    value: Value;
    sharedValues?: ShareableValue[];
  }

  export type Value = PrimitiveValue | ShareableValue | Ref;

  export type PrimitiveValue = string | number | boolean | null | undefined;

  /**
   * Array of values.
   */
  export type Array = Value[];

  export interface TypedObject {
    /**
     * Type of the object. If omitted, the object's type should be inferred from runtime.
     */
    $?: string | [string, ...Value[]];

    /**
     * Object fields.
     */
    [key: string]: Value;
  }

  /**
   * Custom typed object that is serialized as a plain object.
   */
  export interface CustomTypedObject {
    $: [string, Value];
  }

  export type ShareableValue = TypedObject | Array | CustomTypedObject;

  /**
   * Reference to a shared value in the document.
   */
  export interface Ref {
    $: number;
  }

  export interface SerializeContext {

  }

  export interface DeserializeContext {

  }

  export interface Serializable<TValue extends abstract new (...args: any[]) => any, TIntermediates = unknown> {
    [serialize]?(ctx: SerializeContext): TIntermediates;
    [deserializeInto]?(ctx: DeserializeContext, input: TIntermediates): void;
    [constructorParameters]?(ctx: SerializeContext): ConstructorParameters<TValue>;
  }
}
