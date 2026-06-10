import postcss from "postcss";
import PxToUnit, { postcss as postcssPluginFlag } from "../../index.js";

postcss([
  PxToUnit({
    targetUnit: "vw&rem",
    ignoreThreshold: 0,
    viewportWidth: 750,
    viewportHeight: 500,
    htmlFontSize: 16,
    unitPrecision: 4,
    excludeFiles: ["vendor", /legacy/],
    excludeSelectors: [".ignore", /^\.legacy/],
    excludeProperties: ["border", /^--/],
    cacheSize: Infinity,
    debug: false,
  }),
]);

const enabled: boolean = postcssPluginFlag;

// @ts-expect-error targetUnit must be one of the supported unit modes.
PxToUnit({ targetUnit: "px" });

// @ts-expect-error numeric options do not accept string values.
PxToUnit({ viewportWidth: "750" });
