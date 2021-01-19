const fs = require('fs');

const BondMaker = artifacts.require('EthBondMakerCollateralizedUsdc');

const { maturityScale } = require('../test/constants.js');

module.exports = async (deployer) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let bondMakerAddress = data.ethBondMakerCollateralizedUSDC;
    if (!bondMakerAddress) {
        await deployer.deploy(
            BondMaker,
            data.usdc,
            data.priceInverseOracle,
            data.lienToken,
            data.bondTokenName,
            data.bondTokenFactory,
            maturityScale,
            {
                gas: 6500000,
            }
        );
        const bondMakerContract = await BondMaker.deployed();
        bondMakerAddress = bondMakerContract.address;
    }

    const output = {
        ...data,
        ethBondMakerCollateralizedUSDC: bondMakerAddress,
    };
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
