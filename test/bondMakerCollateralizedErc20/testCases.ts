import {
  lineSegmentToFnMap,
  days,
  FlattenLineSegment,
  assertBondGroup,
} from "../util";

export const fnMapInvalid0 = [] as FlattenLineSegment[];
export const fnMapInvalid1 = [[0, 0, 1 / 100, 0]] as FlattenLineSegment[];
export const fnMapInvalid2 = [
  [0, 0, 1 / 100, 0],
  [1 / 100, 0, 1 / 50, 0],
] as FlattenLineSegment[];
export const fnMapImmortal0 = [
  [0, 0, 1 / 100, 1 / 100],
] as FlattenLineSegment[]; // wrapped ETH
export const fnMapSolid1 = [
  [0, 0, 1 / 100, 1 / 100],
  [1 / 100, 1 / 100, 1 / 50, 1 / 100],
] as FlattenLineSegment[]; // pure solid
export const fnMapLiquid1 = [
  [0, 0, 1 / 100, 0],
  [1 / 100, 0, 1 / 50, 1 / 100],
] as FlattenLineSegment[]; // pure liquid

assertBondGroup([fnMapSolid1, fnMapLiquid1]);

export const fnMapImmortal1 = [
  [0, 0, 1 / 50, 0],
  [1 / 50, 0, 3 / 100, 1 / 100],
] as FlattenLineSegment[]; // pure liquid
export const fnMapImmortal2 = [
  [0, 0, 1 / 100, 0],
  [1 / 100, 0, 3 / 100, 1 / 100],
  [3 / 100, 1 / 100, 1 / 25, 1 / 100],
] as FlattenLineSegment[]; // solid
export const fnMapImmortal3 = [
  [0, 0, 1 / 100, 0],
  [1 / 100, 0, 1 / 50, 1 / 200],
  [1 / 50, 1 / 200, 3 / 100, 0],
  [3 / 100, 0, 1 / 25, 0],
] as FlattenLineSegment[]; // triangle

const testCases = {
  registerNewBond: [
    {
      errorMessage: "",
      periodSecBeforeMaturity: 4 * days,
      fnMap: lineSegmentToFnMap(fnMapSolid1),
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 4 * days,
      fnMap: lineSegmentToFnMap(fnMapLiquid1),
    },
    {
      errorMessage: "polyline must not be empty array",
      periodSecBeforeMaturity: 4 * days,
      fnMap: lineSegmentToFnMap(fnMapInvalid0),
    },
    {
      errorMessage: "the bond is 0-value at any price",
      periodSecBeforeMaturity: 4 * days,
      fnMap: lineSegmentToFnMap(fnMapInvalid1),
    },
    {
      errorMessage: "the sequential segments must not have the same gradient",
      periodSecBeforeMaturity: 4 * days,
      fnMap: lineSegmentToFnMap(fnMapInvalid2),
    },
    {
      errorMessage: "the maturity is too far",
      periodSecBeforeMaturity: 365 * days + 1,
      fnMap: lineSegmentToFnMap(fnMapSolid1),
    },
    {
      errorMessage: "the maturity has already expired",
      periodSecBeforeMaturity: 0,
      fnMap: lineSegmentToFnMap(fnMapSolid1),
    },
  ],
  registerNewBondGroup: [
    {
      errorMessage: "",
      bondGroup: {
        untilMaturity: 4 * days,
      },
      bondTypes: [
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapSolid1),
        },
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapLiquid1),
        },
      ],
    },
    {
      errorMessage: "the maturity of the bonds must be same",
      bondGroup: {
        untilMaturity: 4 * days,
      },
      bondTypes: [
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapSolid1),
        },
        {
          untilMaturity: 4 * days + 1,
          fnMap: lineSegmentToFnMap(fnMapLiquid1),
        },
      ],
    },
    {
      errorMessage: "except the first bond must not be pure SBT",
      bondGroup: {
        untilMaturity: 4 * days,
      },
      bondTypes: [
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapLiquid1),
        },
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapSolid1),
        },
      ],
    },
    {
      errorMessage:
        "the total price at any rateBreakPoints should be the same value as the rate",
      bondGroup: {
        untilMaturity: 4 * days,
      },
      bondTypes: [
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapSolid1),
        },
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapSolid1),
        },
      ],
    },
    {
      errorMessage: "the bond group should consist of 2 or more bonds",
      bondGroup: {
        untilMaturity: 4 * days,
      },
      bondTypes: [],
    },
    {
      errorMessage: "the bond group should consist of 2 or more bonds",
      bondGroup: {
        untilMaturity: 4 * days,
      },
      bondTypes: [
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapImmortal0),
        },
      ],
    },
    {
      errorMessage: "the maturity of the bonds must be same",
      bondGroup: {
        untilMaturity: 4 * days + 1,
      },
      bondTypes: [
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapSolid1),
        },
        {
          untilMaturity: 4 * days,
          fnMap: lineSegmentToFnMap(fnMapLiquid1),
        },
      ],
    },
  ],
  issueNewBonds: [
    {
      success: true,
      underlyingAmount: 0.001,
    },
  ],
  exchangeEquivalentBonds: [
    {
      errorMessage: "",
      periodSecBeforeMaturity: 3 * days,
      inputBondGroup: {
        fnMaps: [
          lineSegmentToFnMap(fnMapSolid1),
          lineSegmentToFnMap(fnMapLiquid1),
        ],
      },
      outputBondGroup: {
        fnMaps: [
          lineSegmentToFnMap(fnMapSolid1),
          lineSegmentToFnMap(fnMapImmortal1),
          lineSegmentToFnMap(fnMapImmortal2),
          lineSegmentToFnMap(fnMapImmortal3),
        ],
      },
      mintingAmount: "0.01",
    },
  ],
  reverseBondGroupToCollateral: [
    {
      errorMessage: "",
      mintSBTAmount: "0.01",
      burnSBTAmount: "0.01",
      expired: false,
    },
    {
      errorMessage:
        "Returned error: VM Exception while processing transaction: revert failed to burn bond token -- Reason given: failed to burn bond token.",
      mintSBTAmount: "0.01",
      burnSBTAmount: "0.011",
      expired: false,
    },
    {
      errorMessage:
        "Returned error: VM Exception while processing transaction: revert the maturity has already expired -- Reason given: the maturity has already expired.",
      mintSBTAmount: "0.01",
      burnSBTAmount: "0.01",
      expired: true,
    },
  ],
};

export default testCases;
