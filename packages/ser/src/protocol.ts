// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SerProtocol {
  export const VERSION = '202605';

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
    $?: string;

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
}
