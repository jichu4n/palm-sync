import {SString, SStringNT, SUInt16BE, SUInt8} from 'serio';
import {
  DLP_ARG_ID_BASE,
  DlpRequest,
  DlpResponse,
  DlpResponseStatus,
  dlpArg,
  optDlpArg,
} from '../dlp-protocol';

const COMMAND_ID = 42;

// Request and response without args.
class EmptyDlpRequest extends DlpRequest<EmptyDlpResponse> {
  commandId = COMMAND_ID;
  responseType = EmptyDlpResponse;
}
class EmptyDlpResponse extends DlpResponse {
  commandId = COMMAND_ID;
}

// Request and response with args.
class TestDlpRequest extends DlpRequest<TestDlpResponse> {
  commandId = COMMAND_ID;
  responseType = TestDlpResponse;

  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  num1 = 0;
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  num2 = 0;
  @dlpArg(DLP_ARG_ID_BASE + 1, SString)
  str1 = '';
}
class TestDlpResponse extends DlpResponse {
  commandId = COMMAND_ID;
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  num1 = 0;
  @optDlpArg(DLP_ARG_ID_BASE + 1, SStringNT)
  str1 = '';
  @optDlpArg(DLP_ARG_ID_BASE + 1, SString)
  str2 = '';
}

describe('dlp-protocol', function () {
  test('empty request and response', function () {
    const request = new EmptyDlpRequest();
    expect(request.serialize()).toStrictEqual(
      Buffer.of(
        COMMAND_ID,
        0 // argc
      )
    );
    const response = new EmptyDlpResponse();
    const responseBuffer = Buffer.of(
      COMMAND_ID | (1 << 7),
      0, // argc
      0, // status
      0 // status
    );
    expect(
      response.deserialize(Buffer.concat([responseBuffer, Buffer.alloc(100)]))
    ).toStrictEqual(4);

    // Change command ID.
    responseBuffer[0] += 1;
    expect(() => response.deserialize(responseBuffer)).toThrow(
      /^Command ID mismatch/
    );
    responseBuffer[0] -= 1;

    // Set error status.
    responseBuffer[3] = DlpResponseStatus.ERROR_SYSTEM;
    expect(() => response.deserialize(responseBuffer)).toThrow(
      /^DLP response status/
    );
    responseBuffer[3] = 0;
  });

  test('request serialization and deserialization', function () {
    const request = TestDlpRequest.with({
      num1: 50,
      num2: 100,
      str1: 'a'.repeat(300), // Longer than tiny arg max length (256)
    });
    const expectedRequestBuffer = Buffer.of(
      COMMAND_ID,
      2, // argc
      DLP_ARG_ID_BASE, // arg 1 ID
      3, // arg 1 size
      50, // num1,
      0, // num2
      100, // num2
      (DLP_ARG_ID_BASE + 1) | (1 << 7), // arg 2 ID | short arg bitmask
      0, // padding
      (request.str1.length >> 8) & 0xff, // arg 2 size
      request.str1.length & 0xff, // arg 2 size
      ...Array(300).fill('a'.charCodeAt(0)) // str1
    );
    expect(request.serialize()).toStrictEqual(expectedRequestBuffer);
    const request2 = new TestDlpRequest();
    expect(
      request2.deserialize(
        Buffer.concat([expectedRequestBuffer, Buffer.alloc(100)])
      )
    ).toStrictEqual(expectedRequestBuffer.length);
    expect(request2.num1).toStrictEqual(request.num1);
    expect(request2.num2).toStrictEqual(request.num2);
    expect(request2.str1).toStrictEqual(request.str1);
  });

  test('response deserialization', function () {
    // Empty response, missing required arg.
    const responseBuffer1 = Buffer.of(
      COMMAND_ID | (1 << 7),
      0, // argc
      0, // status
      0 // status
    );
    expect(() =>
      TestDlpResponse.from(Buffer.concat([responseBuffer1, Buffer.alloc(100)]))
    ).toThrow(/^Argument count mismatch/);

    // Response with required arg but no optional arg.
    const responseBuffer2 = Buffer.of(
      COMMAND_ID | (1 << 7),
      1, // argc
      0, // status
      0, // status,
      DLP_ARG_ID_BASE, // arg 1 ID
      1, // arg 1 size
      42 // num1
    );
    const response2 = TestDlpResponse.from(
      Buffer.concat([responseBuffer2, Buffer.alloc(100)])
    );
    expect(response2.num1).toStrictEqual(42);

    // Response with required arg and optional arg.
    const responseBuffer3 = Buffer.of(
      COMMAND_ID | (1 << 7),
      2, // argc
      0, // status
      0, // status,
      DLP_ARG_ID_BASE, // arg 1 ID
      1, // arg 1 size
      42, // num1
      (DLP_ARG_ID_BASE + 1) | (1 << 7), // arg 2 ID | short arg bitmask
      0, // padding
      (301 >> 8) & 0xff, // arg 2 size
      301 & 0xff, // arg 2 size
      ...Array(100).fill('a'.charCodeAt(0)), // str1
      0, // str 1 terminator
      ...Array(200).fill('b'.charCodeAt(0)) // str2
    );
    const response3 = TestDlpResponse.from(
      Buffer.concat([responseBuffer3, Buffer.alloc(100)])
    );
    expect(response3.num1).toStrictEqual(42);
    expect(response3.str1).toStrictEqual('a'.repeat(100));
    expect(response3.str2).toStrictEqual('b'.repeat(200));
  });
});
