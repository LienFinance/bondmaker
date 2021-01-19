const fs = require('fs');

const TestUSDC = artifacts.require('TestUSDC');

module.exports = async (deployer, network, accounts) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let usdcAddress = data.usdc;
    if (!usdcAddress) {
        if (network === 'mainnet') {
            throw new Error('the USDC address was not given');
        }

        await deployer.deploy(TestUSDC);
        usdcAddress = TestUSDC.address;
        const usdcContract = await TestUSDC.at(usdcAddress);
        await usdcContract.mint(10000e6, { from: accounts[0] });
    }

    const output = {
        ...data,
        usdc: usdcAddress,
    };
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
