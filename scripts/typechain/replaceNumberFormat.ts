import fs from 'fs';

function replaceNumberFormat() {
    const fileName = 'types/truffle-contracts/index.d.ts';
    const content = fs.readFileSync('types/truffle-contracts/index.d.ts');
    const newContent = content
        .toString()
        .replace(`import { BigNumber } from "bignumber.js";`, `import BigNumber from "bn.js";`);
    fs.writeFileSync(fileName, newContent);
}

export default replaceNumberFormat;
