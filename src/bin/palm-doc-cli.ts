#!/usr/bin/env node

import {program} from 'commander';
import fs from 'fs-extra';
import path from 'path';
import PalmDoc from '../palm-doc';
// Not using resolveJsonModule because it causes the output to be generated
// relative to the root directory instead of src/.
const packageJson = require('../../package.json');

if (require.main === module) {
  (async () => {
    program.name('palm-doc').version(packageJson.version);

    program
      .command('decode <document.pdb>')
      .description('Decode a PalmDOC PDB file to text.')
      .option('-o, --output <document.txt>', 'path to output text file')
      .action(async (inputFilePath: string, options: any) => {
        const doc = new PalmDoc();
        try {
          const buffer = await fs.readFile(inputFilePath);
          doc.parseFrom(buffer);
        } catch (e) {
          console.error(`Could not open '${inputFilePath}': ${e.message}`);
          process.exit(1);
        }
        const outputFilePath =
          options.output || replaceOrAddFileExt(inputFilePath, 'pdb', 'txt');
        await fs.writeFile(outputFilePath, doc.text, 'utf-8');
      });

    program
      .command('encode <document.txt>')
      .description('Encode a text file to PalmDOC PDB format.')
      .option(
        '-n, --name <document name>',
        'document name (default: file name)'
      )
      .option('-o, --output <document.pdb>', 'path to output PalmDOC PDB file')
      .action(async (inputFilePath: string, options: any) => {
        const doc = new PalmDoc();
        try {
          doc.text = await fs.readFile(inputFilePath, 'utf-8');
        } catch (e) {
          console.error(`Could not open '${inputFilePath}': ${e.message}`);
          process.exit(1);
        }
        doc.name = options.name || path.basename(inputFilePath);
        const outputFilePath =
          options.output || replaceOrAddFileExt(inputFilePath, 'txt', 'pdb');
        await fs.writeFile(outputFilePath, doc.serialize());
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
