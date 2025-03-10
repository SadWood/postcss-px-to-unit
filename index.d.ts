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
}

declare const postcssPxToUnit: (options?: Options) => Plugin;

export default postcssPxToUnit;
export const postcss: boolean;
