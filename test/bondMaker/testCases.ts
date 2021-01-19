import {BigNumber} from "bignumber.js";

import {
  lineSegmentToFnMap,
  days,
  FlattenLineSegment,
  assertBondGroup,
} from "../util";

const lineSegmentList = [
  [0, 0, 100, 100], // 0
  [100, 100, 200, 100], // 1
  [0, 0, 100, 0],
  [100, 0, 200, 100],
  [0, 0, 120, 120], // 4
  [120, 120, 240, 120], // 5
  [0, 0, 120, 0], // 6
  [120, 0, 240, 120], // 7
  [120, 0, 240, 0],
  [240, 0, 360, 120],
  [120, 0, 240, 60], // 10
  [240, 60, 360, 120],
  [360, 120, 480, 120],
  [240, 60, 360, 0],
  [360, 0, 480, 0],
  [100000.0001, 100000.0003, 100000.0005, 100000.0007],
  [100, 100, 200, 200], // 16
  [200, 100, 300, 100], // 17
  [200, 100, 300, 200], // 18
  [120, 0, 240, 30], // 19
  [120, 0, 360, 120],
  [0, 0, 240, 0],
] as FlattenLineSegment[];

export const fnMapInvalid0 = lineSegmentToFnMap([]);
export const fnMapInvalid1 = lineSegmentToFnMap([lineSegmentList[6]]);
export const fnMapInvalid2 = lineSegmentToFnMap([
  lineSegmentList[6],
  lineSegmentList[8],
]);

export const fnMapSolid1 = lineSegmentToFnMap([
  lineSegmentList[0],
  lineSegmentList[1],
]);
export const fnMapLiquid1 = lineSegmentToFnMap([
  lineSegmentList[2],
  lineSegmentList[3],
]);

assertBondGroup([
  [lineSegmentList[0], lineSegmentList[1]],
  [lineSegmentList[2], lineSegmentList[3]],
]);

export const fnMapSolid2 = lineSegmentToFnMap([
  lineSegmentList[4],
  lineSegmentList[5],
]);
export const fnMapLiquid2 = lineSegmentToFnMap([
  lineSegmentList[6],
  lineSegmentList[7],
]);

export const fnMapImmortal0 = lineSegmentToFnMap([lineSegmentList[0]]); // wrapped ETH

// fnMapImmortal1, fnMapImmortal2 and fnMapImmortal3 is immortal options corresponding to fnMapSolid2.
export const fnMapImmortal1 = lineSegmentToFnMap([
  lineSegmentList[21],
  lineSegmentList[9],
]);
export const fnMapImmortal2 = lineSegmentToFnMap([
  lineSegmentList[6],
  lineSegmentList[20],
  lineSegmentList[12],
]);
export const fnMapImmortal3 = lineSegmentToFnMap([
  lineSegmentList[6],
  lineSegmentList[10],
  lineSegmentList[13],
  lineSegmentList[14],
]);

assertBondGroup([
  [lineSegmentList[4], lineSegmentList[5]],
  [lineSegmentList[6], lineSegmentList[7]],
]);

assertBondGroup([
  [lineSegmentList[4], lineSegmentList[5]],
  [lineSegmentList[21], lineSegmentList[9]],
  [lineSegmentList[6], lineSegmentList[20], lineSegmentList[12]],
  [
    lineSegmentList[6],
    lineSegmentList[10],
    lineSegmentList[13],
    lineSegmentList[14],
  ],
]);

export const fnMapImmortal4 = lineSegmentToFnMap([
  lineSegmentList[6],
  lineSegmentList[10],
]);

export const fnMapImmortal5 = lineSegmentToFnMap([
  lineSegmentList[6],
  lineSegmentList[19],
]);

export const fnMapSolid3 = lineSegmentToFnMap([
  lineSegmentList[0],
  lineSegmentList[1],
  lineSegmentList[17],
]);
export const fnMapLiquid3 = lineSegmentToFnMap([
  lineSegmentList[2],
  lineSegmentList[3],
  lineSegmentList[18],
]);

const testCases = {
  // generateBondID: [
  //     {
  //         success: true,
  //         maturity: 0,
  //         fnMap: fnMapSolid1,
  //         bondID: '0x48a6ee5fd89b9ee8d34659a69be685ec92c6de8a76b2281d25a0f0b34158d4b6',
  //     },
  // ],
  registerNewBond: [
    {
      errorMessage: "",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapSolid1,
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapLiquid1,
    },
    {
      errorMessage: "polyline must not be empty array",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapInvalid0,
    },
    {
      errorMessage: "the bond is 0-value at any price",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapInvalid1,
    },
    {
      errorMessage: "the sequential segments must not have the same gradient",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapInvalid2,
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapImmortal0,
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapImmortal1,
    },
    {
      errorMessage: "the sequential segments must not have the same gradient",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapSolid3,
    },
    {
      errorMessage: "the sequential segments must not have the same gradient",
      periodSecBeforeMaturity: 4 * days,
      fnMap: fnMapLiquid3,
    },
    {
      errorMessage: "the maturity is too far",
      periodSecBeforeMaturity: 365 * days + 1,
      fnMap: fnMapSolid1,
    },
    {
      errorMessage: "the maturity has already expired",
      periodSecBeforeMaturity: 0,
      fnMap: fnMapSolid1,
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
          fnMap: fnMapSolid1,
        },
        {
          untilMaturity: 4 * days,
          fnMap: fnMapLiquid1,
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
          fnMap: fnMapSolid1,
        },
        {
          untilMaturity: 4 * days + 1,
          fnMap: fnMapLiquid1,
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
          fnMap: fnMapLiquid1,
        },
        {
          untilMaturity: 4 * days,
          fnMap: fnMapSolid1,
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
          fnMap: fnMapSolid1,
        },
        {
          untilMaturity: 4 * days,
          fnMap: fnMapSolid1,
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
          fnMap: fnMapImmortal0,
        },
      ],
    },
    {
      errorMessage: "",
      bondGroup: {
        untilMaturity: 4 * days,
      },
      bondTypes: [
        {
          untilMaturity: 4 * days,
          fnMap: fnMapSolid2,
        },
        {
          untilMaturity: 4 * days,
          fnMap: fnMapImmortal4,
        },
        {
          untilMaturity: 4 * days,
          fnMap: fnMapImmortal4,
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
          fnMap: fnMapSolid1,
        },
        {
          untilMaturity: 4 * days,
          fnMap: fnMapLiquid1,
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
  exchangeEquivalentBonds: [
    {
      errorMessage: "",
      periodSecBeforeMaturity: 3 * days,
      inputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapLiquid2],
      },
      outputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapImmortal4, fnMapImmortal4],
      },
      mintingAmount: "0.01",
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 3 * days,
      inputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapLiquid2],
      },
      outputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapImmortal1, fnMapImmortal2, fnMapImmortal3],
      },
      mintingAmount: "0.01",
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 3 * days,
      inputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapImmortal1, fnMapImmortal2, fnMapImmortal3],
      },
      outputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapImmortal1, fnMapImmortal2, fnMapImmortal3],
      },
      mintingAmount: "0.01",
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 3 * days,
      inputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapImmortal4, fnMapImmortal4],
      },
      outputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapImmortal4, fnMapImmortal5, fnMapImmortal5],
      },
      mintingAmount: "0.01",
    },
    {
      errorMessage: "",
      periodSecBeforeMaturity: 3 * days,
      inputBondGroup: {
        fnMaps: [fnMapSolid2, fnMapImmortal4, fnMapImmortal5, fnMapImmortal5],
      },
      outputBondGroup: {
        fnMaps: [
          fnMapSolid2,
          fnMapImmortal5,
          fnMapImmortal5,
          fnMapImmortal5,
          fnMapImmortal5,
        ],
      },
      mintingAmount: "0.01",
    },
    // {
    //     errorMessage: '',
    //     periodSecBeforeMaturity: 3 * days,
    //     inputBondGroup: {
    //         fnMaps: [
    //             lineSegmentToFnMap([
    //                 [0, 0, 100, 100],
    //                 [100, 100, 200, 100],
    //                 [200, 100, 240, 100],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 5, 0],
    //                 [5, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 10, 0],
    //                 [10, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 15, 0],
    //                 [15, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 20, 0],
    //                 [20, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 25, 0],
    //                 [25, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 30, 0],
    //                 [30, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 35, 0],
    //                 [35, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 40, 0],
    //                 [40, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 45, 0],
    //                 [45, 0, 100, 0],
    //                 [100, 0, 200, 5],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 100, 0],
    //                 [100, 0, 200, 75],
    //             ]),
    //         ],
    //     },
    //     outputBondGroup: {
    //         fnMaps: [
    //             lineSegmentToFnMap([
    //                 [0, 0, 100, 100],
    //                 [100, 100, 200, 100],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 100, 0],
    //                 [100, 0, 200, 100],
    //                 [200, 100, 300, 0],
    //                 [300, 0, 400, 300],
    //                 [400, 300, 500, 0],
    //                 [500, 0, 600, 500],
    //                 [600, 500, 700, 0],
    //                 [700, 0, 800, 700],
    //                 [800, 700, 900, 0],
    //                 [900, 0, 1000, 900],
    //                 [1000, 900, 1100, 0],
    //                 [1100, 0, 1200, 1100],
    //                 [1200, 1100, 1300, 0],
    //                 [1300, 0, 1400, 1300],
    //                 [1400, 1300, 1500, 0],
    //                 [1500, 0, 1600, 1500],
    //                 [1600, 1500, 1700, 0],
    //                 [1700, 0, 1800, 1700],
    //                 [1800, 1700, 1900, 0],
    //                 [1900, 0, 2000, 1900],
    //                 [2000, 1900, 2100, 0],
    //                 [2100, 0, 2200, 2100],
    //                 [2200, 2100, 2300, 0],
    //                 [2300, 0, 2400, 2300],
    //                 [2400, 2300, 2500, 0],
    //                 [2500, 0, 2600, 2500],
    //                 [2600, 2500, 2700, 0],
    //                 [2700, 0, 2800, 2700],
    //                 [2800, 2700, 2900, 0],
    //                 [2900, 0, 3000, 2900],
    //                 [3000, 2900, 3100, 0],
    //                 [3100, 0, 3200, 0],
    //             ]),
    //             lineSegmentToFnMap([
    //                 [0, 0, 200, 0],
    //                 [200, 0, 300, 200],
    //                 [300, 200, 400, 0],
    //                 [400, 0, 500, 400],
    //                 [500, 400, 600, 0],
    //                 [600, 0, 700, 600],
    //                 [700, 600, 800, 0],
    //                 [800, 0, 900, 800],
    //                 [900, 800, 1000, 0],
    //                 [1000, 0, 1100, 1000],
    //                 [1100, 1000, 1200, 0],
    //                 [1200, 0, 1300, 1200],
    //                 [1300, 1200, 1400, 0],
    //                 [1400, 0, 1500, 1400],
    //                 [1500, 1400, 1600, 0],
    //                 [1600, 0, 1700, 1600],
    //                 [1700, 1600, 1800, 0],
    //                 [1800, 0, 1900, 1800],
    //                 [1900, 1800, 2000, 0],
    //                 [2000, 0, 2100, 2000],
    //                 [2100, 2000, 2200, 0],
    //                 [2200, 0, 2300, 2200],
    //                 [2300, 2200, 2400, 0],
    //                 [2400, 0, 2500, 2400],
    //                 [2500, 2400, 2600, 0],
    //                 [2600, 0, 2700, 2600],
    //                 [2700, 2600, 2800, 0],
    //                 [2800, 0, 2900, 2800],
    //                 [2900, 2800, 3000, 0],
    //                 [3000, 0, 3100, 3000],
    //                 [3100, 3000, 3200, 3100],
    //             ]),
    //         ],
    //     },
    //     mintingAmount: '0.01',
    // },
  ],
  liquidateBond: [
    {
      errorMessage: "",
      bonds: [
        {
          fnMap: fnMapSolid1,
          price: new BigNumber("0.5000e+18").shiftedBy(-18),
        },
        {
          fnMap: fnMapLiquid1,
          price: new BigNumber("0.5000e+18").shiftedBy(-18),
        },
      ],
      issuingBondAmount: new BigNumber("1.0e+8").shiftedBy(-8),
      periodSecBeforeMaturity: 15 * days,
      periodSecBeforeLiquidation: 16 * days,
      rateETH2USD: 200, // 200 USD/ETH
      volatility: 0,
      oracleHintId: ">latestId",
    },
    {
      success: false,
      errorMessage:
        "Returned error: VM Exception while processing transaction: revert the bond has not expired yet -- Reason given: the bond has not expired yet.",
      bonds: [
        {
          fnMap: fnMapSolid2,
          price: new BigNumber("0").shiftedBy(-8),
        },
        {
          fnMap: fnMapLiquid2,
          price: new BigNumber("0").shiftedBy(-8),
        },
      ],
      issuingBondAmount: new BigNumber("1.0e+8").shiftedBy(-8),
      periodSecBeforeMaturity: 2 * days,
      periodSecBeforeLiquidation: 1 * days,
      rateETH2USD: 200,
      volatility: 0,
      oracleHintId: 0,
    },
    {
      errorMessage: "",
      bonds: [
        {
          fnMap: fnMapSolid2,
          price: new BigNumber("0.6000e+8").shiftedBy(-8),
        },
        {
          fnMap: fnMapLiquid2,
          price: new BigNumber("0.4000e+8").shiftedBy(-8),
        },
      ],
      issuingBondAmount: new BigNumber("1.0e+8").shiftedBy(-8),
      periodSecBeforeMaturity: 2 * days,
      periodSecBeforeLiquidation: 3 * days,
      rateETH2USD: 200,
      volatility: 0,
      oracleHintId: 0,
    },
    {
      errorMessage: "",
      bonds: [
        {
          fnMap: fnMapSolid2,
          price: new BigNumber("0.6000e+8").shiftedBy(-8),
        },
        {
          fnMap: fnMapImmortal1,
          price: new BigNumber("0").shiftedBy(-8),
        },
        {
          fnMap: fnMapImmortal2,
          price: new BigNumber("0.2000e+8").shiftedBy(-8),
        },
        {
          fnMap: fnMapImmortal3,
          price: new BigNumber("0.2000e+8").shiftedBy(-8),
        },
      ],
      issuingBondAmount: new BigNumber("1.0e+8").shiftedBy(-8),
      periodSecBeforeMaturity: 2 * days,
      periodSecBeforeLiquidation: 3 * days,
      rateETH2USD: 200,
      volatility: 0,
      oracleHintId: 0,
    },
    {
      errorMessage: "",
      bonds: [
        {
          fnMap: fnMapSolid2,
          price: new BigNumber("0.6000e+8").shiftedBy(-8),
        },
        {
          fnMap: fnMapImmortal4,
          price: new BigNumber("0.4000e+8").shiftedBy(-8),
        },
        {
          fnMap: fnMapImmortal4,
          price: new BigNumber("0").shiftedBy(-8), // redeem with the second bond together
        },
      ],
      issuingBondAmount: new BigNumber("1.0e+8").shiftedBy(-8),
      periodSecBeforeMaturity: 2 * days,
      periodSecBeforeLiquidation: 3 * days,
      rateETH2USD: 200,
      volatility: 0,
      oracleHintId: 0,
    },
  ],
};

export default testCases;
