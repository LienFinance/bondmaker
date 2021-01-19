import BigNumber from "bignumber.js";

const testCases = {
  setRate: [
    {
      rateNumerator: new BigNumber(2).pow(128).minus(1).toString(10),
      rateDenominator: "1",
      errorMessage: "",
    },
    {
      rateNumerator: "1",
      rateDenominator: new BigNumber(2).pow(128).minus(1).toString(10),
      errorMessage: "",
    },
    {
      rateNumerator: "0",
      rateDenominator: "1",
      errorMessage: "",
    },
    {
      rateNumerator: "1",
      rateDenominator: "0",
      errorMessage:
        "Returned error: VM Exception while processing transaction: revert system error: the exchange rate must be non-negative number -- Reason given: system error: the exchange rate must be non-negative number.",
    },
  ],
};

export default testCases;
