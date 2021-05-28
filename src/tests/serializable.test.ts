import {
  SerializableObject,
  serialize,
  serializeWithWrapper,
  UInt16BE,
  UInt8,
} from '../serializable';

/** Example object that exercises `serialize` and `serializeWithWrapper`. */
class TestObject extends SerializableObject {
  @serialize
  prop1 = new UInt8();
  @serializeWithWrapper(UInt16BE)
  prop2 = 0;
}

describe('SerializableObject', function () {
  test('parse and serialize custom object', function () {
    const obj1 = new TestObject();
    expect(obj1.getSerializedLength()).toStrictEqual(3);
    obj1.prop1.value = 42;
    obj1.prop2 = 153;
    const serializedObj1 = obj1.serialize();
    expect(serializedObj1).toHaveLength(3);

    const obj2 = new TestObject();
    obj2.parseFrom(serializedObj1);
    expect(obj2.prop1.value).toStrictEqual(obj1.prop1.value);
    expect(obj2.prop2).toStrictEqual(obj1.prop2);
  });
});
