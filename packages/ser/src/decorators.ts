import { registerClassMeta } from './meta-registry.js';
import type { FieldMeta } from './meta-registry.js';

const SER_FIELD_META = Symbol('ser:fieldMeta');

type SerFieldMetaStore = Record<string, FieldMeta>;

export function serClass(opts: string | { id: string }) {
  const id = typeof opts === 'string' ? opts : opts.id;
  return function <T extends new (...args: any[]) => any>(
    value: T,
    context: ClassDecoratorContext,
  ): void {
    const fieldMetaStore = context.metadata[SER_FIELD_META] as SerFieldMetaStore | undefined;
    const fields: [string, FieldMeta][] = [];
    if (fieldMetaStore) {
      for (const [name, meta] of Object.entries(fieldMetaStore)) {
        fields.push([name, meta]);
      }
    }
    registerClassMeta(value, {
      id,
      fields: fields.length > 0 ? fields : undefined,
    });
  };
}

export function serField(opts?: { fixed?: boolean }) {
  return function (
    _target: undefined | { get: () => unknown; set: (value: unknown) => void },
    context: ClassFieldDecoratorContext | ClassAccessorDecoratorContext,
  ): void {
    if (context.kind !== 'field' && context.kind !== 'accessor') {
      return;
    }
    const name = typeof context.name === 'symbol'
      ? (context.name.description ?? '')
      : context.name;
    const fieldMeta: FieldMeta = {};
    if (opts?.fixed) {
      fieldMeta.fixed = true;
    }
    const fieldMetaStore = (context.metadata[SER_FIELD_META] ??= {}) as SerFieldMetaStore;
    fieldMetaStore[name] = fieldMeta;
  };
}
