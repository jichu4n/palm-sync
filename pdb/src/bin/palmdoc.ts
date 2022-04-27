#!/usr/bin/env node

import {program} from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {DEFAULT_ENCODING, PalmDoc} from '..';
// Not using resolveJsonModule because it causes the output to be generated
// relative to the root directory instead of src/.
const packageJson = require('../../package.json');

if (require.main === module) {
  (async () => {
    program.name('palmdoc').version(packageJson.version);

    program
      .command('decode <document.pdb>')
      .description('Decode a PalmDOC PDB file to text.')
      .option(
        '--input-encoding <encoding>',
        'text encoding of input PalmDOC PDB file',
        DEFAULT_ENCODING
      )
      .option(
        '--output-encoding <encoding>',
        'text encoding for output text file',
        'utf-8'
      )
      .option('-o, --output <document.txt>', 'path to output text file')
      .action(async (inputFilePath: string, opts: any) => {
        const doc = new PalmDoc();
        try {
          const buffer = await fs.readFile(inputFilePath);
          doc.deserialize(buffer, {encoding: opts.inputEncoding});
        } catch (e: any) {
          console.error(`Could not open '${inputFilePath}': ${e.message}`);
          process.exit(1);
        }
        const outputFilePath =
          opts.output || replaceOrAddFileExt(inputFilePath, 'pdb', 'txt');
        await fs.writeFile(outputFilePath, doc.text, opts.outputEncoding);
      });

    program
      .command('encode <document.txt>')
      .description('Encode a text file to PalmDOC PDB format.')
      .option(
        '--input-encoding <encoding>',
        'text encoding of input text file',
        'utf-8'
      )
      .option(
        '--output-encoding <encoding>',
        'text encoding for output PalmDOC PDB file',
        DEFAULT_ENCODING
      )
      .option(
        '-n, --name <document name>',
        'document name (default: file name)'
      )
      .option('--compress', 'enable compression', true)
      .option('--no-compress', 'disable compression')
      .option('-o, --output <document.pdb>', 'path to output PalmDOC PDB file')
      .action(async (inputFilePath: string, opts: any) => {
        const doc = new PalmDoc();
        try {
          doc.text = await fs.readFile(
            inputFilePath,
            opts.inputEncoding as string
          );
        } catch (e: any) {
          console.error(`Could not open '${inputFilePath}': ${e.message}`);
          process.exit(1);
        }
        doc.name = opts.name || path.basename(inputFilePath);
        const outputFilePath =
          opts.output || replaceOrAddFileExt(inputFilePath, 'txt', 'pdb');
        await fs.writeFile(
          outputFilePath,
          doc.serialize({
            encoding: opts.outputEncoding,
            enableCompression: !!opts.compress,
          })
        );
      });

    await program.parseAsync();
  })();
}

/** Replace file extension in a path (case insenstive). */
function replaceOrAddFileExt(filePath: string, oldExt: string, newExt: string) {
  if (filePath.toLowerCase().endsWith(`.${oldExt.toLowerCase()}`)) {
    return filePath.substr(0, filePath.length - oldExt.length) + newExt;
  } else {
    return `${filePath}.${newExt}`;
  }
}
