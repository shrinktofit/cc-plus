# @cc-plus/ser

`@cc-plus/ser` serializes JavaScript object graphs into documents that are meant to be readable by both humans and AI agents, while still preserving enough runtime semantics to deserialize the value back.

The protocol is schema-aware when class metadata is registered, and it keeps shared references explicit instead of hiding them in backend-specific syntax.

## Basic Usage

```ts
import { deserialize, serialize } from '@cc-plus/ser';

const document = serialize(value);
const valueAgain = deserialize(document);
```

The default serialization assumptions target JSON-like backends. If the backing format can represent IEEE 754 special numbers directly, pass a preset or explicit assumptions:

```ts
serialize(value, { assumptions: 'json5' });
serialize(value, { assumptions: 'yaml' });
serialize(value, { assumptions: { ieee754: true } });
```

## Document Shape

Every serialized document has:

```ts
interface Document {
  version: '202605';
  value: Value;
  sharedValues?: ShareableValue[];
}
```

`sharedValues` is present only when the object graph contains repeated references or cycles.

## `$` Discriminator Rules

The `$` field is reserved by the protocol. Its meaning is determined by shape:

| Shape | Meaning | Example |
| --- | --- | --- |
| `{ "$": 0 }` | Reference to `sharedValues[0]` | `{ "$": 0 }` |
| `{ "$": "type.id", ... }` | Typed object with fields | `{ "$": "game.Player", "level": 3 }` |
| `{ "$": ["type.id", payload] }` | Custom typed object | `{ "$": ["es.Date", 1778938200000] }` |
| `{ "$": "intrinsic.*" }` | Intrinsic marker | `{ "$": "intrinsic.nan" }` |

Do not use `$` as an application data field in plain objects that need to be deserialized unambiguously.

## Shared References

Repeated references are lifted into `sharedValues`:

```ts
{
  "sharedValues": [
    { "value": 42 }
  ],
  "value": {
    "a": { "$": 0 },
    "b": { "$": 0 }
  },
  "version": "202605"
}
```

Classes registered with `nonShared: true` are serialized by value even when multiple fields point to the same instance.

## Class Metadata

Register class metadata to preserve runtime types:

```ts
registerClassMeta(Player, {
  id: 'game.Player',
  fields: ['name', 'level'],
});
```

Use `fixed: true` for fields whose runtime type is invariant. This omits nested type information. For object fields, the deserializer infers the fixed type from the field's current runtime value after constructing the owning object, so no explicit `type` is needed:

```ts
registerClassMeta(EventRecord, {
  id: 'game.EventRecord',
  fields: [
    ['createdAt', { fixed: true }],
  ],
});
```

Then `createdAt` stores the Date payload directly:

```ts
{
  "$": "game.EventRecord",
  "createdAt": 1778938200000
}
```

The owning class must initialize fixed object fields with a non-null object value. If the current value is `null`, `undefined`, or otherwise does not expose an object constructor, deserialization throws because the fixed type cannot be inferred.

Fixed array fields need an element type because an empty array cannot reveal its element constructor:

```ts
registerClassMeta(PointList, {
  id: 'game.PointList',
  fields: [
    ['points', { fixed: true, array: { type: Point } }],
  ],
});
```

## Backend Assumptions

Assumptions describe what the backing text format can represent directly.

| Preset | IEEE 754 special numbers | Notes |
| --- | --- | --- |
| `json` | No | Default. `NaN`, `Infinity`, and `-Infinity` use intrinsic markers. |
| `json5` | Yes | Special numbers are emitted directly. |
| `yaml` | Yes | Special numbers are emitted directly. |

When IEEE 754 special numbers are not assumed:

```ts
NaN       -> { "$": "intrinsic.nan" }
Infinity  -> { "$": "intrinsic.inf" }
-Infinity -> { "$": "intrinsic.-inf" }
```

`bigint` is always serialized through the `es.BigInt` codec:

```ts
123n -> { "$": ["es.BigInt", "123"] }
```

## Built-in Types

Built-in custom codecs currently include:

| Runtime type | Type id | Payload |
| --- | --- | --- |
| `bigint` | `es.BigInt` | Decimal string |
| `Date` | `es.Date` | Milliseconds since epoch |
| `Map` | `es.Map` | Entry array |
| `Set` | `es.Set` | Value array |
| `RegExp` | `es.RegExp` | `{ source, flags }` |
| Typed arrays except `DataView` | `es.*Array` | Element array |

For `BigInt64Array` and `BigUint64Array`, elements are serialized as `number | string`: safe integers use numbers, and larger values use decimal strings.

## Backend Caveats

The protocol value model can contain `undefined`, especially as a root value or array element. Plain JSON cannot represent `undefined` without a backend-specific transform. Object fields whose value is `undefined` are omitted during serialization.

Deserialization constructs registered classes. Treat documents as trusted input unless the caller adds its own validation or allow-listing boundary.
