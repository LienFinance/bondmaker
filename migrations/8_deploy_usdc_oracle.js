const fs = require('fs');

const USDCOracle = artifacts.require('USDCOracle');

module.exports = async (deployer) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let usdcOracleAddress = data.usdcOracle;
    if (!usdcOracleAddress) {
        await deployer.deploy(USDCOracle);
        const usdcOracleInstance = await USDCOracle.deployed();
        usdcOracleAddress = usdcOracleInstance.address;
    }

    const output = {
        ...data,
        usdcOracle: usdcOracleAddress,
    };
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
