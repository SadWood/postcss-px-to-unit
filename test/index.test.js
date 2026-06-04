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

async function transformCss(css, options, processOptions = {}) {
  const result = await postcss([PxToUnit(options)]).process(css, {
    from: undefined,
    ...processOptions,
  });
  expect(result.warnings()).toHaveLength(0);
  return result.css;
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

  test("px to vh", async () => {
    await expect(
      transformCss(".test{width:10px;height:20px}", {
        targetUnit: "vh",
      })
    ).resolves.toBe(".test{width:1.49925vh;height:2.9985vh}");
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

  test("custom viewportHeight", async () => {
    await expect(
      transformCss(".test{height:10px}", {
        targetUnit: "vh",
        viewportHeight: 500,
      })
    ).resolves.toBe(".test{height:2vh}");
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

  test("uppercase PX values are ignored", async () => {
    await expect(
      transformCss(".test{width:10PX;height:10px}", {
        targetUnit: "vh",
      })
    ).resolves.toBe(".test{width:10PX;height:1.49925vh}");
  });

  test("px inside CSS variable names is not converted", async () => {
    await expect(
      transformCss(".a{width:var(--size-10px)}")
    ).resolves.toBe(".a{width:var(--size-10px)}");
  });

  test("px inside calc is converted", async () => {
    await expect(
      transformCss(".a{width:calc(100% - 10px)}")
    ).resolves.toBe(".a{width:calc(100% - 2.66667vw)}");
  });

  test("negative px values keep their sign", async () => {
    await expect(
      transformCss(".a{margin:-10px}")
    ).resolves.toBe(".a{margin:-2.66667vw}");
  });

  test("px-like suffixes are not partially converted", async () => {
    await expect(
      transformCss(".a{animation-name:slide10px}")
    ).resolves.toBe(".a{animation-name:slide10px}");
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

  test("missing source file does not break string exclude files", async () => {
    await expect(
      transformCss(".test{width:10px}", {
        excludeFiles: ["node_modules"],
      })
    ).resolves.toBe(".test{width:2.66667vw}");
  });

  test("missing source file does not break regexp exclude files", async () => {
    await expect(
      transformCss(".test{width:10px}", {
        excludeFiles: [/node_modules/],
      })
    ).resolves.toBe(".test{width:2.66667vw}");
  });
});

describe("Option edge cases", () => {
  test.each([0, -1, Number.NaN, Infinity])(
    "cacheSize %p keeps conversion output stable",
    async (cacheSize) => {
      await expect(
        transformCss(".test{width:10px}", {
          cacheSize,
        })
      ).resolves.toBe(".test{width:2.66667vw}");
    }
  );

  test.each([0, -1, Number.NaN, Infinity])(
    "viewportWidth %p falls back to the default value",
    async (viewportWidth) => {
      await expect(
        transformCss(".test{width:10px}", {
          viewportWidth,
        })
      ).resolves.toBe(".test{width:2.66667vw}");
    }
  );

  test.each([0, -1, Number.NaN, Infinity])(
    "viewportHeight %p falls back to the default value",
    async (viewportHeight) => {
      await expect(
        transformCss(".test{width:10px}", {
          targetUnit: "vh",
          viewportHeight,
        })
      ).resolves.toBe(".test{width:1.49925vh}");
    }
  );

  test.each([0, -1, Number.NaN, Infinity])(
    "htmlFontSize %p falls back to the default value",
    async (htmlFontSize) => {
      await expect(
        transformCss(".test{width:10px}", {
          targetUnit: "rem",
          htmlFontSize,
        })
      ).resolves.toBe(".test{width:0.26667rem}");
    }
  );

  test("zero ignoreThreshold converts 1px values", async () => {
    await expect(
      transformCss(".test{width:1px}", {
        ignoreThreshold: 0,
      })
    ).resolves.toBe(".test{width:0.26667vw}");
  });

  test.each([Number.NaN, Infinity, -1])(
    "unitPrecision %p falls back to default precision (5)",
    async (unitPrecision) => {
      await expect(
        transformCss(".test{width:10px}", { unitPrecision })
      ).resolves.toBe(".test{width:2.66667vw}");
    }
  );

  test("unitPrecision 0 rounds to an integer", async () => {
    await expect(
      transformCss(".test{width:10px}", { unitPrecision: 0 })
    ).resolves.toBe(".test{width:3vw}");
  });

  test.each([Number.NaN, Infinity, -1])(
    "ignoreThreshold %p falls back to default and still converts",
    async (ignoreThreshold) => {
      await expect(
        transformCss(".test{width:10px}", { ignoreThreshold })
      ).resolves.toBe(".test{width:2.66667vw}");
    }
  );

  test("unsupported targetUnit leaves declarations unchanged and warns once", async () => {
    const result = await postcss([PxToUnit({ targetUnit: "px" })]).process(
      ".test{width:10px}",
      { from: undefined }
    );
    expect(result.css).toBe(".test{width:10px}");

    const warnings = result.warnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toContain('Unsupported targetUnit "px"');
  });
});
