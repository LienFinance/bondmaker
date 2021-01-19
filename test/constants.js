"use strict";
exports.__esModule = true;
exports.maturityScale = void 0;
require("dotenv").config();
var VERSION = process.env.VERSION;
console.log("VERSION:", VERSION);
var bondMakerConfigStaging = {
  maturityScale: 1,
};
var bondMakerConfigProduction = {
  maturityScale: 3600,
};
var maturityScale = (VERSION === "staging"
  ? bondMakerConfigStaging
  : bondMakerConfigProduction
).maturityScale;
exports.maturityScale = maturityScale;
