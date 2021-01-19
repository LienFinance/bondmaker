const fs = require('fs');

const GeneralizedPricing = artifacts.require('GeneralizedPricing');
const BondPricer = artifacts.require('BondPricer');
const SbtPricer = artifacts.require('SbtPricerWithStableBorder');

module.exports = async (deployer) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let generalizedPricingAddress = data.generalizedPricing;
    if (!generalizedPricingAddress) {
        await deployer.deploy(GeneralizedPricing);
        const generalizedPricingInstance = await GeneralizedPricing.deployed();
        generalizedPricingAddress = generalizedPricingInstance.address;
    }

    let bondPricerAddress = data.bondPricer;
    if (!bondPricerAddress) {
        await deployer.deploy(BondPricer, generalizedPricingAddress);
        const bondPricerInstance = await BondPricer.deployed();
        bondPricerAddress = bondPricerInstance.address;
    }

    let sbtPricerAddress = data.sbtPricer;
    if (!sbtPricerAddress) {
        await deployer.deploy(SbtPricer, generalizedPricingAddress, 0.975 * 10 ** 4);
        const sbtPricerInstance = await SbtPricer.deployed();
        sbtPricerAddress = sbtPricerInstance.address;
    }

    const output = {
        ...data,
        generalizedPricing: generalizedPricingAddress,
        bondPricer: bondPricerAddress,
        sbtPricer: sbtPricerAddress,
    };
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
