const fs = require('fs');

const Migrations = artifacts.require('Migrations');

module.exports = function (deployer) {
    deployer.deploy(Migrations);

    const output = {};
    const dump = process.env.DUMP || 'dump.json';
    fs.writeFileSync(dump, JSON.stringify(output, null, 2));
};
