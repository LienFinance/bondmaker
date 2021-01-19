import testCases from "./testCases";
import {callRegisterNewBond, callGetBond} from "../bondMaker/callFunction";
import {
  getBondTokenName,
  getBlockTimestampSec,
  vmExceptionTemplate,
} from "../util";
import {init} from "../initCollateralizedErc20";
import {Ierc20Contract} from "../../types/truffle-contracts";

const TestUSDC = artifacts.require("TestUsdc");
const BondMaker = artifacts.require("EthBondMakerCollateralizedUsdc");
const BondToken = artifacts.require("BondTokenCollateralizedErc20");

contract("BondMaker", () => {
  let contractAddresses: {
    bondMaker: string;
  };

  before(async () => {
    const usdcContract = await TestUSDC.new();
    contractAddresses = await init(
      (usdcContract as unknown) as Ierc20Contract,
      BondMaker,
      null,
      null,
      null
    );
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

          if (errorMessage !== "") {
            assert.fail("did not fail `BondMaker.registerNewBond` test");
          }
        });
      }
    );
  });
});
