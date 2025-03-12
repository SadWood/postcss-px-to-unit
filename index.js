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

  // 创建全局值转换缓存
  const valueCache = new Map();

  // 创建一个单次转换函数，处理vw和rem的同时转换
  const convertValue = (originalValue) => {
    // 只需一次替换操作就能确定是否需要转换
    const needsConversion =
      originalValue.replace(pxReg, (match, pxValue) => {
        if (pxValue !== undefined && parseFloat(pxValue) > ignoreThreshold) {
          return "#"; // 任意占位符，只是用来标记需要转换
        }
        return match;
      }) !== originalValue;

    let hasChange = false;
    let vwValue = originalValue,
      remValue = originalValue;

    // 一次性标记是否有px需要转换，避免多次执行正则表达式
    let hasPx = false;
    const checkPx = originalValue.replace(pxReg, (match, px) => {
      if (px !== undefined && parseFloat(px) > ignoreThreshold) {
        hasPx = true;
      }
      return match;
    });

    if (!hasPx) {
      valueCache.set(originalValue, { hasChange: false });
      return { hasChange: false };
    }

    hasChange = true;

    // 只在需要时进行实际转换
    if (processVw) {
      vwValue = originalValue.replace(pxReg, vwReplacer);
    }

    if (processRem) {
      remValue = originalValue.replace(pxReg, remReplacer);
    }

    valueCache.set(originalValue, {
      hasChange,
      vwValue,
      remValue,
    });

    return { hasChange, vwValue, remValue };
  };

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

          const originalValue = decl.value;
          if (!originalValue.includes("px")) return;

          // 使用缓存检查这个值是否已经处理过
          const cacheKey = originalValue;
          if (valueCache.has(cacheKey)) {
            const cachedResult = valueCache.get(cacheKey);

            if (!cachedResult.hasChange) return;

            if (targetUnit === "vw") {
              decl.value = cachedResult.vwValue;
            } else if (targetUnit === "rem") {
              decl.value = cachedResult.remValue;
            } else if (targetUnit === "vw&rem") {
              decl.value = cachedResult.remValue;
              decl.after({
                prop: decl.prop,
                value: cachedResult.vwValue,
              });
            }
            return;
          }

          // 使用缓存检查这个值是否已经处理过
          const { hasChange, vwValue, remValue } = convertValue(originalValue);

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
