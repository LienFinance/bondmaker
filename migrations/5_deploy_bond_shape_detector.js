const fs = require('fs');

const DetectBondShape = artifacts.require('DetectBondShape');

module.exports = async (deployer) => {
    const inputFile = process.env.DUMP || 'dump.json';
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let bondShapeDetectorAddress = data.bondShapeDetector;
    if (!bondShapeDetectorAddress) {
        await deployer.deploy(DetectBondShape);
        const bondShapeDetectorInstance = await DetectBondShape.deployed();
        bondShapeDetectorAddress = bondShapeDetectorInstance.address;
    }

    const output = {
        ...data,
        bondShapeDetector: bondShapeDetectorAddress,
    };
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
