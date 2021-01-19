import testCases from "./testCases";

const BondToken = artifacts.require("TestBondTokenCollateralizedEth");

contract("BondToken", (accounts) => {
  describe("getDeployer", () => {
    it(`case 0`, async () => {
      const bondTokenContract = await BondToken.new("", "", 8);

      const res = await bondTokenContract.getDeployer();

      assert.equal(
        res,
        accounts[0],
        "the result of getDeployer differ from expected"
      );
    });
  });

  describe("expire", () => {
    const cases = testCases.setRate;
    cases.forEach(
      ({rateNumerator, rateDenominator, errorMessage}, caseIndex) => {
        it(`case ${caseIndex}`, async () => {
          const bondTokenContract = await BondToken.new("", "", 8);

          try {
            await bondTokenContract.expire(rateNumerator, rateDenominator);
          } catch (err) {
            if (err.message === errorMessage) {
              return;
            }

            throw err;
          }

          if (errorMessage !== "") {
            assert.fail("should fail to execute setRate");
          }
        });
      }
    );
  });

  describe("getRate", () => {
    const {rateNumerator, rateDenominator} = testCases.setRate[0];
    let BondTokenAddress: string;

    before(async () => {
      const bondTokenContract = await BondToken.new("", "", 8);
      BondTokenAddress = bondTokenContract.address;
      await bondTokenContract.expire(rateNumerator, rateDenominator);
    });

    it(`case 0`, async () => {
      const bondTokenContract = await BondToken.at(BondTokenAddress);

      const res = await bondTokenContract.getRate();

      assert.equal(
        res[0].toString(),
        rateNumerator.toString(),
        "the result of getRate differ from expected"
      );
      assert.equal(
        res[1].toString(),
        rateDenominator.toString(),
        "the result of getRate differ from expected"
      );
    });
  });

  describe("violateOnlyMinter", () => {
    it(`case 0`, async () => {
      const errorMessage =
        "Returned error: VM Exception while processing transaction: revert Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.";
      const bondTokenContract = await BondToken.new("", "", 8, {
        from: accounts[0],
      });

      try {
        await bondTokenContract.mint(accounts[1], 1, {from: accounts[1]});
      } catch (err) {
        if (err.message === errorMessage) {
          return;
        }

        throw err;
      }

      assert.fail("should fail to execute mint");
    });
  });
});
