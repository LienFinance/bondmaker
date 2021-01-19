const fs = require('fs');

const Oracle = artifacts.require('TestOracle');
const PriceInverseOracle = artifacts.require('PriceInverseOracle');
const HistoricalVolatilityOracle = artifacts.require('HistoricalVolatilityOracle');
const LienToken = artifacts.require('TestLienToken');
const BondTokenName = artifacts.require('BondTokenName');
const BondTokenFactory = artifacts.require('BondTokenFactory');

module.exports = async (deployer) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let marketOracleAddress = data.oracle;
    if (!marketOracleAddress) {
        const initRateETH2USD = 400;
        const initVolatility = 0;
        await deployer.deploy(Oracle, initRateETH2USD * 100000000, initVolatility * 100000000);
        marketOracleAddress = Oracle.address;
    }

    let priceInverseOracleAddress = data.priceInverseOracle;
    if (!priceInverseOracleAddress) {
        await deployer.deploy(PriceInverseOracle, marketOracleAddress);
        const priceInverseOracleContract = await PriceInverseOracle.deployed();
        priceInverseOracleAddress = priceInverseOracleContract.address;
    }

    let volatilityOracleAddress = data.volatilityOracle;
    if (!volatilityOracleAddress) {
        await deployer.deploy(HistoricalVolatilityOracle, marketOracleAddress);
        const volatilityOracleContract = await HistoricalVolatilityOracle.deployed();
        volatilityOracleAddress = volatilityOracleContract.address;
    }

    let lienTokenAddress = data.lienToken;
    if (!lienTokenAddress) {
        await deployer.deploy(LienToken);
        const lienTokenContract = await LienToken.deployed();
        lienTokenAddress = lienTokenContract.address;
    }

    let bondTokenNameAddress = data.bondTokenName;
    if (!bondTokenNameAddress) {
        await deployer.deploy(BondTokenName);
        const bondTokenNameContract = await BondTokenName.deployed();
        bondTokenNameAddress = bondTokenNameContract.address;
    }

    let bondTokenFactoryAddress = data.bondTokenFactory;
    if (!bondTokenFactoryAddress) {
        await deployer.deploy(BondTokenFactory);
        const bondTokenFactoryContract = await BondTokenFactory.deployed();
        bondTokenFactoryAddress = bondTokenFactoryContract.address;
    }

    const output = {
        ...data,
        oracle: marketOracleAddress,
        priceInverseOracle: priceInverseOracleAddress,
        volatilityOracle: volatilityOracleAddress,
        lienToken: lienTokenAddress,
        bondTokenName: bondTokenNameAddress,
        bondTokenFactory: bondTokenFactoryAddress,
    };
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
