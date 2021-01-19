import fs from 'fs';

function overloadAtMethod() {
    const fileName = 'types/truffle-contracts/merge.d.ts';
    const content = fs.readFileSync(fileName);
    const newContent = content.toString().replace(
        `  namespace Truffle {
    interface Artifacts {`,
        `  namespace Truffle {
    interface Contract<T> {
      at(address: string): Promise<T>; // overload
    }

    interface Artifacts {`
    );
    fs.writeFileSync(fileName, newContent);
}

export default overloadAtMethod;
