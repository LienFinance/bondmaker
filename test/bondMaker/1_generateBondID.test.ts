import testCases from "./testCases";
import {init} from "../init";

const BondMaker = artifacts.require("BondMakerCollateralizedEth");

// contract('BondMaker', () => {
//     let contractAddresses: {
//         bondMaker: string;
//     };

//     before(async () => {
//         contractAddresses = await init(BondMaker, null, null, null);
//     });

//     describe('generateBondID', () => {
//         const cases = testCases.generateBondID;

//         cases.forEach(({ maturity, fnMap, bondID }, caseIndex) => {
//             it(`case ${caseIndex}`, async () => {
//                 const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
//                 const actualBondID = await bondMakerContract.generateBondID(maturity, fnMap);

//                 assert.equal(actualBondID, bondID, `invalid bond ID`);
//             });
//         });
//     });
// });
