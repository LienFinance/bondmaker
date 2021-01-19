import testCases from "./testCases";
import {nullAddress, getBlockTimestampSec, vmExceptionTemplate} from "../util";
import {callRegisterNewBond, callRegisterNewBondGroup} from "./callFunction";
import {init} from "../init";

const BondMaker = artifacts.require("BondMakerCollateralizedEth");

contract("BondMaker", () => {
  let contractAddresses: {
    bondMaker: string;
  };

  before(async () => {
    contractAddresses = await init(BondMaker, null, null, null);
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
