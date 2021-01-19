import { program } from 'commander';

import { handler } from './handler';
import getAbi from './get-abi';

program
    .command('get-abi [contract-name]')
    .description('output ABI files for contracts with that name, or all if no contract name given')
    .option(
        '-i, --build-dir <dir>',
        'search build data files in that directory (default: "build/contracts/")'
    )
    .option(
        '-o, --output-dir <dir>',
        'write ABI files in that directory (default: standard output)'
    )
    .action(handler(getAbi));

program.parse(process.argv);
