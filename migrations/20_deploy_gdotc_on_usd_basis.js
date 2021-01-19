const fs = require('fs');

const GeneralizedDotc = artifacts.require('GeneralizedDotc');

module.exports = async (deployer, network) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let gdotcAddress = data.generalizedDotcOnUsdBasis;
    const bondMakerAddress = data.bondMaker;
    const volatilityAddress = data.volatilityOracle;
    const usdcOracleAddress = data.usdcOracle; // USD/USDC
    const bondShapeDetectorAddress = data.bondShapeDetector;
    if (
        !gdotcAddress &&
        bondMakerAddress &&
        volatilityAddress &&
        usdcOracleAddress &&
        bondShapeDetectorAddress
    ) {
        await deployer.deploy(
            GeneralizedDotc,
            bondMakerAddress,
            volatilityAddress,
            usdcOracleAddress,
            bondShapeDetectorAddress
        );
        const gdotcInstance = await GeneralizedDotc.deployed();
        gdotcAddress = gdotcInstance.address;
    }

    let bondPoolID = '';
    let usdcPoolID = '';
    let ethPoolID = '';
    const usdcAddress = data.usdc;
    const bondPricerAddress = data.bondPricer;
    if (network === 'ropsten' || network === 'mainnet') {
        if (usdcAddress && usdcOracleAddress && bondPricerAddress) {
            const gdotcInstance = await GeneralizedDotc.at(gdotcAddress);
            const feeBaseE0 = 0.003;
            try {
                const setLbtPoolRes = await gdotcInstance.createVsErc20Pool(
                    usdcAddress,
                    usdcOracleAddress,
                    bondPricerAddress,
                    feeBaseE0 * 10 ** 4,
                    true
                ); // sell bonds
                // const bondPoolID = setLbtPoolRes.logs[0].args.poolID;
                console.log('create USDC vs LBT exchange:', bondPoolID);
            } catch (err) {
                console.log(err.message);
            }

            try {
                const setUsdcPoolRes = await gdotcInstance.createVsErc20Pool(
                    usdcAddress,
                    usdcOracleAddress,
                    bondPricerAddress,
                    feeBaseE0 * 10 ** 4,
                    false
                ); // sell USDC
                // const usdcPoolID = setUsdcPoolRes.logs[0].args.poolID;
                console.log('create LBT vs USDC exchange:', usdcPoolID);
            } catch (err) {
                console.log(err.message);
            }
        }

        const ethOracleAddress = data.oracle; // USD/ETH
        if (ethOracleAddress && bondPricerAddress) {
            const gdotcInstance = await GeneralizedDotc.at(gdotcAddress);
            const feeBaseE0 = 0.003;
            try {
                const setLbtPoolRes = await gdotcInstance.createVsEthPool(
                    ethOracleAddress,
                    bondPricerAddress,
                    feeBaseE0 * 10 ** 4,
                    true
                ); // sell bonds
                // const bondPoolID = setLbtPoolRes.logs[0].args.poolID;
                console.log('create ETH vs LBT exchange:', bondPoolID);
            } catch (err) {
                console.log(err.message);
            }

            try {
                const setEthPoolRes = await gdotcInstance.createVsEthPool(
                    ethOracleAddress,
                    bondPricerAddress,
                    feeBaseE0 * 10 ** 4,
                    false
                ); // sell USDC
                // const ethPoolID = setEthPoolRes.logs[0].args.poolID;
                console.log('create LBT vs ETH exchange:', ethPoolID);
            } catch (err) {
                console.log(err.message);
            }
        }

        const sbtPricerAddress = data.sbtPricer; // ETH/USD
        if (bondMakerAddress && sbtPricerAddress && bondPricerAddress) {
            const gdotcInstance = await GeneralizedDotc.at(gdotcAddress);
            const feeBaseE0 = 0.003;
            try {
                const setLbtPoolRes = await gdotcInstance.createVsBondPool(
                    bondMakerAddress,
                    volatilityAddress,
                    sbtPricerAddress,
                    bondPricerAddress,
                    feeBaseE0 * 10 ** 4
                ); // sell bonds
                // const bondPoolID = setLbtPoolRes.logs[0].args.poolID;
                console.log('create SBT vs LBT exchange:', bondPoolID);
            } catch (err) {
                console.log(err.message);
            }
        }
    }

    const output = {
        ...data,
        generalizedDotcOnUsdBasis: gdotcAddress,
    };

    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
