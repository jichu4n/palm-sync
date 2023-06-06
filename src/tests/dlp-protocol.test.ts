import {DlpRequest, DlpResponse, DlpResponseStatus} from '../dlp-protocol';

describe('dlp-protocol', function () {
  test('empty request and response', function () {
    const commandId = 42;
    class EmptyDlpRequest extends DlpRequest<EmptyDlpResponse> {
      commandId = commandId;
      responseType = EmptyDlpResponse;
    }
    class EmptyDlpResponse extends DlpResponse {
      commandId = commandId;
    }

    const request = new EmptyDlpRequest();
    expect(request.serialize()).toStrictEqual(
      Buffer.of(
        commandId,
        0 // argc
      )
    );
    const response = new EmptyDlpResponse();
    const responseBuffer = Buffer.of(
      commandId | (1 << 7),
      0, // argc
      0, // status
      0, // status
      0 // unused
    );
    expect(response.deserialize(responseBuffer)).toStrictEqual(4);

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
});
