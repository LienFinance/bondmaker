const fs = require('fs');

const BondMakerHelper = artifacts.require('BondMakerHelper');

module.exports = async (deployer) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let bondMakerHelperAddress = data.bondMakerHelper;
    if (!bondMakerHelperAddress) {
        await deployer.deploy(BondMakerHelper);
        const bondMakerHelperContract = await BondMakerHelper.deployed();
        bondMakerHelperAddress = bondMakerHelperContract.address;
    }

    const output = {
        ...data,
        bondMakerHelper: bondMakerHelperAddress,
    };
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
