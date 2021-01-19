import * as fs from 'fs';

export function getAbi(
    contractName: string | undefined,
    options: {
        buildDir?: string;
        outputDir?: string;
    }
) {
    let { buildDir, outputDir } = options;

    if (buildDir === undefined) {
        buildDir = 'build/contracts/';
    } else if (!buildDir.endsWith('/')) {
        throw new Error('the build directory must end with "/"');
    }

    if (contractName === undefined) {
        contractName = '*';
    }

    const inputFilesNameExp = `^(${contractName.replace(/\.?\*+/g, '.*')})\.json$`;
    const files = fs
        .readdirSync(buildDir, { withFileTypes: true })
        .filter((dirent) => dirent.isFile && dirent.name.match(inputFilesNameExp));

    for (const dirent of files) {
        const fileName = dirent.name;
        const inputFile = buildDir + fileName;
        const buildData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

        if (typeof buildData !== 'object') {
            console.error(`not found ABI in ${inputFile}`);
            continue;
        }

        const { abi } = buildData;
        if (abi === undefined) {
            console.error(`not found ABI in ${inputFile}`);
            continue;
        }

        console.info(fileName);

        const output = JSON.stringify(abi, null, 2);

        if (outputDir === undefined) {
            console.log(output);
        } else if (!outputDir.endsWith('/')) {
            throw new Error('the output directory must end with "/"');
        } else {
            const outputFile = outputDir + fileName;
            fs.writeFileSync(outputFile, output);
        }
    }
}

export default getAbi;
