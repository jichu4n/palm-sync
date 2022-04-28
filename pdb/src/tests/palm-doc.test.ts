import fs from 'fs-extra';
import _ from 'lodash';
import path from 'path';
import {DeserializeOptions} from 'serio';
import {PalmDoc, PalmDocSerializeOptions} from '..';

describe('PalmDoc', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, 'testdata', 'OnBoardHeaderV40.pdb')
    );
    const doc = new PalmDoc();
    doc.deserialize(buffer);

    expect(doc.text).toContain('#define NULL 0');
  });

  for (const {label, text, serializeOpts, parseOpts} of [
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
    {
      label: '汉语',
      text: '汉语，又称中文、唐话、华语，指整个汉语族或者其语族里的一种语言。',
      serializeOpts: {
        encoding: 'gb2312',
        enableCompression: true,
      },
      parseOpts: {
        encoding: 'gb2312',
      },
    },
    {
      label: '漢語',
      text: '漢語，又稱中文、唐話、華語，指整個漢語族或者其語族里的一種語言。',
      serializeOpts: {
        encoding: 'big5',
        enableCompression: true,
      },
      parseOpts: {
        encoding: 'big5',
      },
    },
    {
      label: '日本語',
      text: '日本語（にほんご、にっぽんご、英: Japanese）は、主に日本国内や日本人同士の間で使用されている言語。',
      serializeOpts: {
        encoding: 'shiftjis',
        enableCompression: true,
      },
      parseOpts: {
        encoding: 'shiftjis',
      },
    },
  ] as Array<{
    label: string;
    text: string;
    serializeOpts?: PalmDocSerializeOptions;
    parseOpts?: DeserializeOptions;
  }>) {
    test(`serialize ${label}`, async function () {
      // Create doc1.
      const doc1 = new PalmDoc();
      doc1.name = label.substr(0, 31);
      doc1.text = text;

      // Serialize to buffer and deserialize back into doc2.
      const buffer = doc1.serialize(serializeOpts);
      const doc2 = new PalmDoc();
      doc2.deserialize(buffer, parseOpts);

      // Check doc2 contents.
      expect(doc2.name).toStrictEqual(doc1.name);
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
