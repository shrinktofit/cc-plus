import * as cc from 'cc';
import { registerClassMeta, type ClassMetaRegisterOptions } from '../meta-registry.js';

registerCCClassMeta(cc.Vec2, {
  custom: {
    encode: (_, value) => [value.x, value.y],
    decodeInto: (_, input, target) => {
      target.x = input[0];
      target.y = input[1];
    },
  },
});

registerCCClassMeta(cc.Vec3, {
  custom: {
    encode: (_, value) => [value.x, value.y, value.z],
    decodeInto: (_, input, target) => {
      target.x = input[0];
      target.y = input[1];
      target.z = input[2];
    },
  },
});

registerCCClassMeta(cc.Vec4, {
  custom: {
    encode: (_, value) => [value.x, value.y, value.z, value.w],
    decodeInto: (_, input, target) => {
      target.x = input[0];
      target.y = input[1];
      target.z = input[2];
      target.w = input[3];
    },
  },
});

registerCCClassMeta(cc.Quat, {
  custom: {
    encode: (_, value) => [value.x, value.y, value.z, value.w],
    decodeInto: (_, input, target) => {
      target.x = input[0];
      target.y = input[1];
      target.z = input[2];
      target.w = input[3];
    },
  },
});

registerCCClassMeta(cc.Mat3, {
  custom: {
    encode: (_, value) => [
      value.m00, value.m01, value.m02,
      value.m03, value.m04, value.m05,
      value.m06, value.m07, value.m08,
    ],
    decodeInto: (_, input, target) => {
      target.m00 = input[0];
      target.m01 = input[1];
      target.m02 = input[2];
      target.m03 = input[3];
      target.m04 = input[4];
      target.m05 = input[5];
      target.m06 = input[6];
      target.m07 = input[7];
      target.m08 = input[8];
    },
  },
});

registerCCClassMeta(cc.Color, {

  custom: {
    encode: (_, value) => value.toHEX(),
    decodeInto: (_, input, target) => {
      cc.Color.fromHEX(target, input);
    },
  },
});

registerCCClassMeta(cc.Size, {
  custom: {
    encode: (_, value) => [value.x, value.y, value.width, value.height],
    decodeInto: (_, input, target) => {
      target.x = input[0];
      target.y = input[1];
      target.width = input[2];
      target.height = input[3];
    },
  },
});

registerCCClassMeta(cc.Rect, {

  custom: {
    encode: (_, value) => [value.x, value.y, value.width, value.height],
    decodeInto: (_, input, target) => {
      target.x = input[0];
      target.y = input[1];
      target.width = input[2];
      target.height = input[3];
    },
  },
});

function registerCCClassMeta<T, TIntermediates>(constructor: new (...args: any[]) => T, meta: Omit<ClassMetaRegisterOptions<T, TIntermediates>, 'id'>) {
  const classId = cc.js.getClassId(constructor);
  registerClassMeta(constructor, {
    id: classId,
    ...meta,
  });
}
