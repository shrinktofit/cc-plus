import { expect, it } from 'vitest';
import * as cc from 'cc';
import { serialize } from '@src/serialize.js';
import { SerProtocol } from '@src/protocol.js';
import { deserialize } from '@src/deserialize.js';

it('Vec3', () => {
  const given = new cc.Vec3(1, 2, 3);
  const { serializedValue, deserialize } = testSerialize(given);
  expect(serializedValue).toStrictEqual([1, 2, 3]);
  const deserialized = deserialize();
  expect(deserialized).toStrictEqual(given);
});

function testSerialize(value: unknown) {
  const wrapper = {
    value,
  };

  const serializedDocument = serialize(wrapper);
  expect(serializedDocument).toMatchSnapshot();
  expect(serializedDocument.version).toBe(SerProtocol.VERSION);
  expect(serializedDocument.value).toBeTypeOf('object');
  const typed = (serializedDocument.value as SerProtocol.TypedObject).value as (SerProtocol.TypedObject | SerProtocol.CustomTypedObject);
  const $ = typed.$!;
  expect($).toBeDefined();
  let typeId = '';
  let serializedValue = undefined;
  if (Array.isArray($)) {
    typeId = $[0];
    serializedValue = $[1];
  } else {
    typeId = $;
    const {
      ...props
    } = typed;
    serializedValue = props;
  }
  return {
    serializedTypeId: typeId,

    serializedValue,

    serializedDocument: serializedDocument,

    deserialize: () => {
      const deserializedWrapper = deserialize(serializedDocument) as typeof wrapper;
      expect(deserializedWrapper).toBeTypeOf('object');
      return deserializedWrapper.value;
    },
  };
}
