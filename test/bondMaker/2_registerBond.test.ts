import testCases from "./testCases";
import {callRegisterNewBond, callGetBond} from "./callFunction";
import {
  getBondTokenName,
  getBlockTimestampSec,
  vmExceptionTemplate,
} from "../util";
import {init} from "../init";

const BondMaker = artifacts.require("BondMakerCollateralizedEth");
const BondToken = artifacts.require("BondTokenCollateralizedEth");

contract("BondMaker", () => {
  let contractAddresses: {
    bondMaker: string;
  };

  before(async () => {
    contractAddresses = await init(BondMaker, null, null, null);
  });

  describe("registerNewBond", () => {
    const cases = testCases.registerNewBond;

    cases.forEach(
      ({errorMessage, periodSecBeforeMaturity, fnMap}, caseIndex) => {
        it(`case ${caseIndex}`, async () => {
          const bondMakerContract = await BondMaker.at(
            contractAddresses.bondMaker
          );
          const now = await getBlockTimestampSec();
          const maturity = now + periodSecBeforeMaturity;

          let bondID: string;
          try {
            const bondInfo = await callRegisterNewBond(
              bondMakerContract,
              maturity,
              fnMap
            );
            bondID = bondInfo.bondID;
          } catch (err) {
            if (err.message === vmExceptionTemplate(errorMessage)) {
              return;
            }
            throw err;
          }

          const {bondTokenAddress} = await callGetBond(
            bondMakerContract,
            bondID
          );
          const [shortName, longName] = getBondTokenName(
            fnMap,
            new Date(maturity * 1000)
          );
          const bondTokenContract = await BondToken.at(bondTokenAddress);
          const symbol = await bondTokenContract.symbol();
          const name = await bondTokenContract.name();

          assert.equal(
            symbol,
            shortName,
            "the symbol of bond token differ from expected"
          );
          assert.equal(
            name,
            longName,
            "the name of bond token differ from expected"
          );

          if (errorMessage !== "") {
            assert.fail("did not fail `BondMaker.registerNewBond` test");
          }
        });
      }
    );
  });
});
