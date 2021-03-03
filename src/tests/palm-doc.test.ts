import fs from 'fs-extra';
import _ from 'lodash';
import path from 'path';
import PalmDoc from '../palm-doc';

describe('PalmDoc', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(
        __dirname,
        '..',
        '..',
        'src',
        'tests',
        'testdata',
        'OnBoardHeaderV40.pdb'
      )
    );
    const doc = new PalmDoc();
    doc.parseFrom(buffer);

    expect(doc.text).toContain('#define NULL 0');
  });

  for (const {label, text} of [
    {label: '"Hello, world!"', text: 'Hello, world!'},
    {
      label: '"Hello, world!" repeated 10K times',
      text: 'Hello, world!'.repeat(10000),
    },
    {
      label: '0x00 repeated 10K times',
      text: '\x00'.repeat(10000),
    },
    ..._.times(3, (n) => ({
      label: `10K random base64 letters and spaces (pass #${n})`,
      text: _.times(10000, () =>
        generateRandomBuffer(Math.floor(1 + Math.random() * 10)).toString(
          'base64'
        )
      ).join(' '),
    })),
    ..._.times(3, () => ({
      label: 'base64 encoded random buffer of size 100K (pass #${n})',
      text: generateRandomBuffer(100000).toString('base64'),
    })),
  ]) {
    test(`serialize ${label}`, async function () {
      // Create doc1.
      const doc1 = new PalmDoc();
      doc1.text = text;

      // Serialize to buffer and deserialize back into doc2.
      const buffer = doc1.serialize();
      const doc2 = new PalmDoc();
      doc2.parseFrom(buffer);

      // Check doc2 contents.
      expect(doc2.text).toStrictEqual(doc1.text);
    });
  }
});

/** Fill a Buffer of length n with random numbers. */
function generateRandomBuffer(n: number) {
  const buffer = Buffer.alloc(n);
  let i = 0;
  while (i + 4 <= n) {
    buffer.writeUInt32BE(Math.floor(Math.random() * 0x100000000), i);
    i += 4;
  }
  while (i < n) {
    buffer.writeUInt8(Math.floor(Math.random() * 0x100), i);
    ++i;
  }
  return buffer;
}
