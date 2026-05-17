import { registerClassMeta } from './meta-registry.js';
import type { FieldMeta } from './meta-registry.js';

const fieldMetaStore = new WeakMap<object, Record<string, FieldMeta>>();

export function serClass(opts: string | { id: string }): ClassDecorator {
  const id = typeof opts === 'string' ? opts : opts.id;
  return (constructor) => {
    const rawFieldMeta = fieldMetaStore.get(constructor);
    const fields: [string, FieldMeta][] = [];
    if (rawFieldMeta) {
      for (const [name, meta] of Object.entries(rawFieldMeta)) {
        fields.push([name, meta]);
      }
    }
    fieldMetaStore.delete(constructor);
    registerClassMeta(constructor as unknown as new (...args: any[]) => any, {
      id,
      fields: fields.length > 0 ? fields : undefined,
    });
  };
}

export function serField(opts?: { fixed?: boolean }): PropertyDecorator {
  return (target, propertyKey) => {
    const name = String(propertyKey);
    const fieldMeta: FieldMeta = {};
    if (opts?.fixed) {
      fieldMeta.fixed = true;
    }
    const ctor = typeof target === 'function' ? target : target.constructor;
    if (!fieldMetaStore.has(ctor)) {
      fieldMetaStore.set(ctor, {});
    }
    fieldMetaStore.get(ctor)![name] = fieldMeta;
  };
}
