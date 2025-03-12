import { Plugin } from "postcss";

interface Options {
  targetUnit?: "vw" | "rem" | "vw&rem";
  ignoreThreshold?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  htmlFontSize?: number;
  unitPrecision?: number;
  excludeFiles?: (string | RegExp)[];
  excludeSelectors?: (string | RegExp)[];
  excludeProperties?: (string | RegExp)[];
  cacheSize?: number;
  debug?: boolean;
}

declare const PxToUnit: (options?: Options) => Plugin;

export default PxToUnit;
export const postcss: boolean;
