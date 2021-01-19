import BigNumber from "bignumber.js";

const testCases = {
  testToDigitsString: [
    {
      value: "0",
      digits: "0",
      valueStr: "",
    },
    {
      value: "0",
      digits: "1",
      valueStr: "0",
    },
    {
      value: "0",
      digits: "2",
      valueStr: "00",
    },
    {
      value: "102",
      digits: "0",
      valueStr: "",
    },
    {
      value: "102",
      digits: "1",
      valueStr: "2",
    },
    {
      value: "102",
      digits: "2",
      valueStr: "02",
    },
    {
      value: "102",
      digits: "3",
      valueStr: "102",
    },
    {
      value: "102",
      digits: "4",
      valueStr: "0102",
    },
    {
      value: "102",
      digits: "5",
      valueStr: "00102",
    },
    {
      value: "102",
      digits: "77",
      valueStr: "102".padStart(77, "0"),
    },
    {
      value: "102",
      digits: "78",
      valueStr: "102".padStart(78, "0"),
    },
    {
      value: new BigNumber(2).pow(256).minus(1).toString(10),
      digits: "77",
      valueStr: new BigNumber(2)
        .pow(256)
        .minus(1)
        .minus(new BigNumber(10).pow(77))
        .toString(10),
    },
    {
      value: new BigNumber(2).pow(256).minus(1).toString(10),
      digits: "78",
      valueStr: new BigNumber(2).pow(256).minus(1).toString(10),
    },
    {
      value: new BigNumber(2).pow(256).minus(1).toString(10),
      digits: "79",
      valueStr: "0" + new BigNumber(2).pow(256).minus(1).toString(10),
    },
  ],
};

export default testCases;
