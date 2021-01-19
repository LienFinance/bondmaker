import testCases from "./testCases";
import {nullAddress, getBlockTimestampSec, vmExceptionTemplate} from "../util";
import {
  callRegisterNewBond,
  callRegisterNewBondGroup,
} from "../bondMaker/callFunction";
import {init} from "../initCollateralizedErc20";
import {Ierc20Contract} from "../../types/truffle-contracts";

const TestUSDC = artifacts.require("TestUsdc");
const BondMaker = artifacts.require("EthBondMakerCollateralizedUsdc");

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

  describe("registerNewBondGroup", () => {
    const cases = testCases.registerNewBondGroup;

    cases.map(({errorMessage, bondGroup, bondTypes}, caseIndex) => {
      it(`case ${caseIndex}`, async () => {
        const bondMakerContract = await BondMaker.at(
          contractAddresses.bondMaker
        );
        const now = await getBlockTimestampSec();

        const bondIDs = await bondTypes.reduce(
          async (acc, {untilMaturity, fnMap}) => {
            const maturity = now + untilMaturity;
            const bondIDs = await acc;
            const {bondID} = await callRegisterNewBond(
              bondMakerContract,
              maturity,
              fnMap
            );
            return [...bondIDs, bondID];
          },
          Promise.resolve(new Array<string>())
        );

        let bondGroupID: string;
        try {
          const {
            bondGroupID: actualBondGroupID,
          } = await callRegisterNewBondGroup(
            bondMakerContract,
            bondIDs,
            now + bondGroup.untilMaturity
          );
          bondGroupID = actualBondGroupID.toString();
        } catch (err) {
          assert.equal(
            err.message,
            vmExceptionTemplate(errorMessage),
            "fail to execute registerNewBondGroup"
          );
          console.log("expected error:", err.message);
          return;
        }

        const actualBondGroup = await bondMakerContract.getBondGroup(
          bondGroupID
        );

        const actualSolidBondID = actualBondGroup[0][0];
        assert.notEqual(
          actualSolidBondID,
          nullAddress,
          `invalid solid bond ID`
        );

        const actualLiquidBondID = actualBondGroup[0][1];
        assert.notEqual(
          actualLiquidBondID,
          nullAddress,
          `invalid liquid bond ID`
        );

        if (errorMessage !== "") {
          assert.fail("should fail to call registerNewBondGroup");
        }
      });
    });
  });
});
