import testCases from "./testCases";
import {
  callGetBond,
  callGetBondGroup,
  createBondGroup,
  issueNewBondsCollateralizedEth,
} from "./callFunction";
import {
  lineSegmentToFnMap,
  fromEtherAmount,
  toEtherAmount,
  advanceTime,
  days,
  getBlockTimestampSec,
  mineOneBlock,
  fromBTAmount,
  getEthBalance,
} from "../util";
import BigNumber from "bignumber.js";

const BondMaker = artifacts.require("BondMakerCollateralizedEth");
const BondToken = artifacts.require("BondTokenCollateralizedEth");

const feeRateE3 = 2; // 0.2%

const fnMaps = [
  lineSegmentToFnMap([
    [0, 0, 120, 120],
    [120, 120, 240, 120],
  ]),
  lineSegmentToFnMap([
    [0, 0, 120, 0],
    [120, 0, 240, 120],
  ]),
];

contract("BondMaker", (accounts) => {
  describe("reverseBondGroupToCollateral", () => {
    const cases = testCases.reverseBondGroupToCollateral;
    const periodSecBeforeMaturity = 3 * days;
    let newBondGroupID: string;

    beforeEach(async () => {
      const bondMakerContract = await BondMaker.deployed();
      await advanceTime(1 * days);
      await mineOneBlock();
      const now = await getBlockTimestampSec();
      const {bondGroupID} = await createBondGroup(
        bondMakerContract,
        fnMaps,
        now + periodSecBeforeMaturity
      );
      newBondGroupID = bondGroupID;
    });

    it("should remain no collateral token in the case that the total supply of bonds is zero", async () => {
      const SBTAmount = 0.1;
      const bondMakerContract = await BondMaker.deployed();
      await issueNewBondsCollateralizedEth(
        bondMakerContract,
        newBondGroupID,
        SBTAmount
      );

      await bondMakerContract.reverseBondGroupToCollateral(
        newBondGroupID,
        fromBTAmount(SBTAmount)
      );

      const {bondIDs} = await callGetBondGroup(
        bondMakerContract,
        newBondGroupID
      );
      for (const bondID of bondIDs) {
        const {bondTokenAddress} = await callGetBond(bondMakerContract, bondID);
        const bondTokenContract = await BondToken.at(bondTokenAddress);
        const totalSupply = await bondTokenContract.totalSupply();
        assert.ok(
          totalSupply.toString() === "0",
          "the total supply of bonds is not zero"
        );
      }

      const collateralBalanceOfBondMaker = await getEthBalance(
        bondMakerContract.address
      );

      assert.ok(
        collateralBalanceOfBondMaker.lt(toEtherAmount(feeRateE3)),
        "should remain no collateral token in the BondMaker contract"
      );
    });

    cases.forEach(
      ({errorMessage, mintSBTAmount, burnSBTAmount, expired}, caseIndex) => {
        it(`case ${caseIndex}`, async () => {
          const bondMakerContract = await BondMaker.deployed();
          await issueNewBondsCollateralizedEth(
            bondMakerContract,
            newBondGroupID,
            mintSBTAmount
          );

          if (expired) {
            await advanceTime(periodSecBeforeMaturity);
            await mineOneBlock();
          }

          await getEthBalance(bondMakerContract.address);

          try {
            await bondMakerContract.reverseBondGroupToCollateral(
              newBondGroupID,
              fromBTAmount(burnSBTAmount)
            );
          } catch (err) {
            assert.equal(
              err.message,
              errorMessage,
              "fail to execute reverseBondToETH"
            );
            return;
          }

          if (errorMessage !== "") {
            assert.fail("did not fail `BondMaker.reverseBondToETH` test");
          }
        });
      }
    );
  });
});
