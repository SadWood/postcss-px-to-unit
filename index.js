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

// 缓存匹配规则结果
function createRuleMatcher() {
  const cache = new Map();

  return (value, rule) => {
    const key = `${value}-${rule instanceof RegExp ? rule.toString() : rule}`;
    if (!cache.has(key)) {
      const result =
        typeof rule === "string" ? value.includes(rule) : rule.test(value);
      cache.set(key, result);
    }
    return cache.get(key);
  };
}

const matchesRule = createRuleMatcher();

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

  // 预计算常用值
  const htmlFontSizeInverse = 1 / htmlFontSize;
  const viewportWidthInverse = 100 / viewportWidth;

  // 创建缓存的单位转换器，优化计算方式
  const toRem = createConverter(
    (px, precision) => `${toFixed(px * htmlFontSizeInverse, precision)}rem`
  );

  const toVw = createConverter(
    (px, precision) => `${toFixed(px * viewportWidthInverse, precision)}vw`
  );

  // 缓存需要处理的单位类型，避免重复判断
  const processVw = targetUnit === "vw" || targetUnit === "vw&rem";
  const processRem = targetUnit === "rem" || targetUnit === "vw&rem";

  // 替换函数
  const createReplacer = (converter) => {
    const replacerCache = new Map();

    return (match, pxValue) => {
      // 如果没有捕获到px数值(即匹配的是引号内容或URL)，直接返回原字符串
      if (pxValue === undefined) {
        return match;
      }

      // 使用缓存避免重复计算
      if (replacerCache.has(pxValue)) {
        return replacerCache.get(pxValue);
      }

      const pixelValue = parseFloat(pxValue);
      const result =
        pixelValue <= ignoreThreshold
          ? match
          : converter(pixelValue, unitPrecision);

      replacerCache.set(pxValue, result);
      return result;
    };
  };

  const remReplacer = processRem ? createReplacer(toRem) : null;
  const vwReplacer = processVw ? createReplacer(toVw) : null;

  // 编译一个文件级的缓存来存储已处理过的选择器
  const processedSelectors = new Set();

  return {
    postcssPlugin: "postcss-px-to-unit",
    Once(root) {
      const inputFile = root.source.input.file;

      // 先检查文件是否被排除
      if (isExcluded(inputFile, excludeFiles)) return;

      // 快速标记已处理的规则
      processedSelectors.clear();

      root.walkRules((rule) => {
        // 避免重复处理相同选择器
        if (processedSelectors.has(rule.selector)) return;
        processedSelectors.add(rule.selector);

        if (isExcluded(rule.selector, excludeSelectors)) return;

        rule.walkDecls((decl) => {
          if (isExcluded(decl.prop, excludeProperties)) return;

          // 快速检查是否包含 px，不包含则提前退出
          const originalValue = decl.value;
          if (!originalValue.includes("px")) return;

          let hasChange = false;
          let vwValue, remValue;

          // 只计算需要的值
          if (processVw) {
            vwValue = originalValue.replace(pxReg, (match, px) => {
              const result = vwReplacer(match, px);
              if (result !== match) hasChange = true;
              return result;
            });
          }

          if (processRem) {
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
