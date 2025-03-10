// 这个正则表达式用于匹配px值，但排除引号内和URL内的px
// 四个部分:
// 1. "[^"]+" - 匹配双引号中所有内容
// 2. '[^']+' - 匹配单引号中所有内容
// 3. url\([^\)]+\) - 匹配CSS URL函数
// 4. (\d*\.?\d+)px - 捕获实际需要转换的px值
const pxReg = /"[^"]+"|'[^']+'|url\([^\)]+\)|(\d*\.?\d+)px/g;

function toFixed(number, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}

// 创建带缓存的转换函数
function createConverter(conversionFn) {
  const cache = new Map();

  return (pixelValue, precision) => {
    const key = `${pixelValue}-${precision}`;
    if (!cache.has(key)) {
      cache.set(key, conversionFn(pixelValue, precision));
    }
    return cache.get(key);
  };
}

const matchesRule = (value, rule) =>
  typeof rule === "string" ? value.includes(rule) : rule.test(value);

const isExcluded = (value, rules) =>
  Array.isArray(rules) &&
  rules.length > 0 &&
  rules.some((rule) => matchesRule(value, rule));

export default (options = {}) => {
  const {
    targetUnit = "vw",
    ignoreThreshold = 1,
    viewportWidth = 375,
    htmlFontSize = 37.5,
    unitPrecision = 5,
    excludeFiles = [],
    excludeSelectors = [],
    excludeProperties = [],
  } = options;

  // 创建缓存的单位转换器
  const toRem = createConverter(
    (px, precision) => `${toFixed(px / htmlFontSize, precision)}rem`
  );

  const toVw = createConverter(
    (px, precision) => `${toFixed((px / viewportWidth) * 100, precision)}vw`
  );

  // 替换函数
  const createReplacer = (converter) => (match, pxValue) => {
    // 如果没有捕获到px数值(即匹配的是引号内容或URL)，直接返回原字符串
    if (pxValue === undefined) {
      return match;
    }

    const pixelValue = parseFloat(pxValue);
    return pixelValue <= ignoreThreshold
      ? match
      : converter(pixelValue, unitPrecision);
  };

  const remReplacer = createReplacer(toRem);
  const vwReplacer = createReplacer(toVw);

  return {
    postcssPlugin: "postcss-px-to-unit",
    Once(root) {
      const inputFile = root.source.input.file;
      if (isExcluded(inputFile, excludeFiles)) return;

      root.walkRules((rule) => {
        if (isExcluded(rule.selector, excludeSelectors)) return;

        rule.walkDecls((decl) => {
          if (isExcluded(decl.prop, excludeProperties)) return;

          // 快速检查是否包含 px，不包含则提前退出
          const originalValue = decl.value;
          if (!originalValue.includes("px")) return;

          let hasChange = false;
          let vwValue, remValue;

          // 只计算需要的值
          if (targetUnit === "vw" || targetUnit === "vw&rem") {
            vwValue = originalValue.replace(pxReg, (match, px) => {
              const result = vwReplacer(match, px);
              if (result !== match) hasChange = true;
              return result;
            });
          }

          if (targetUnit === "rem" || targetUnit === "vw&rem") {
            remValue = originalValue.replace(pxReg, (match, px) => {
              const result = remReplacer(match, px);
              if (result !== match) hasChange = true;
              return result;
            });
          }

          if (!hasChange) return;

          if (targetUnit === "vw") {
            decl.value = vwValue;
          } else if (targetUnit === "rem") {
            decl.value = remValue;
          } else if (targetUnit === "vw&rem") {
            decl.value = remValue;
            decl.after({
              prop: decl.prop,
              value: vwValue,
            });
          }
        });
      });
    },
  };
};

export const postcss = true;
