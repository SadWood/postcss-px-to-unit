import { performance } from "node:perf_hooks";
import postcss from "postcss";
import PxToUnit from "../index.js";

const ruleCount = 5000;
const css = Array.from(
  { length: ruleCount },
  (_, index) => `.item-${index}{width:10px;height:20px;margin:${index % 8}px}`
).join("\n");

async function run(targetUnit) {
  const start = performance.now();
  const result = await postcss([
    PxToUnit({
      targetUnit,
      cacheSize: 100,
    }),
  ]).process(css, {
    from: undefined,
  });
  const duration = performance.now() - start;

  return {
    targetUnit,
    duration: `${duration.toFixed(2)}ms`,
    bytes: result.css.length,
  };
}

for (const targetUnit of ["vw", "vh", "rem", "vw&rem"]) {
  console.log(await run(targetUnit));
}
