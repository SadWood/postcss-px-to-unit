import fs from "fs";
import path from "path";
import postcss from "postcss";
import PxToUnit from "../index";

async function runCase(input, output, options) {
  let inputFile = fs.readFileSync(input);
  let outputFile = fs.readFileSync(output, "utf8");
  const result = await postcss([PxToUnit(options)]).process(inputFile, {
    from: input,
  });
  expect(result.css).toEqual(outputFile);
  expect(result.warnings()).toHaveLength(0);
}

describe("Convert", () => {
  test("px to rem", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/rem.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "rem",
    });
  });

  test("px to vw", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/vw.css");
    return runCase(inputFile, outputFile);
  });

  test("px to vw&rem", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/vw&rem.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "vw&rem",
    });
  });

  test("ignore threshold", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/ignore.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "rem",
      ignoreThreshold: 5,
    });
  });

  test("ignore pattern", () => {
    let inputFile = path.resolve(__dirname, "./input/ignore-pattern.css");
    let outputFile = path.resolve(__dirname, "./input/ignore-pattern.css");
    return runCase(inputFile, outputFile);
  });

  test("custom precision", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/precision.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "rem",
      unitPrecision: 2,
    });
  });

  test("custom viewportWidth", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/viewport-width.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "vw",
      viewportWidth: 750,
    });
  });

  test("custom htmlFontSize", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/html-font-size.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "rem",
      htmlFontSize: 16,
    });
  });

  test("no px values", () => {
    let inputFile = path.resolve(__dirname, "./input/no-px.css");
    let outputFile = path.resolve(__dirname, "./input/no-px.css");
    return runCase(inputFile, outputFile);
  });

  test("px in url and quotes", () => {
    let inputFile = path.resolve(__dirname, "./input/url-quotes.css");
    let outputFile = path.resolve(__dirname, "./output/url-quotes.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "rem",
      htmlFontSize: 16,
    });
  });

  test("repeated selectors", () => {
    let inputFile = path.resolve(__dirname, "./input/repeated-selectors.css");
    let outputFile = path.resolve(__dirname, "./output/repeated-selectors.css");
    return runCase(inputFile, outputFile, {
      targetUnit: "rem",
    });
  });
});

describe("Exclude rules", () => {
  test("exclude file", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./input/test.css");
    return runCase(inputFile, outputFile, {
      excludeFiles: [/test/],
    });
  });

  test("exclude selector (regexp)", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./input/test.css");
    return runCase(inputFile, outputFile, {
      excludeSelectors: [/test/],
    });
  });

  test("exclude selector (string)", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./input/test.css");
    return runCase(inputFile, outputFile, {
      excludeSelectors: ["test"],
    });
  });

  test("exclude property (regexp)", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(__dirname, "./output/exclude-property.css");
    return runCase(inputFile, outputFile, {
      excludeProperties: [/^width$/],
    });
  });

  test("exclude property (string)", () => {
    let inputFile = path.resolve(__dirname, "./input/test.css");
    let outputFile = path.resolve(
      __dirname,
      "./output/exclude-property-string.css"
    );
    return runCase(inputFile, outputFile, {
      excludeProperties: ["width"],
    });
  });
});
