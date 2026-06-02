// 该正则有四个分支：前三个分支跳过不应转换的上下文，最后一个分支捕获裸 px 数值。
// 1. "[^"]+"：跳过双引号字符串。
// 2. '[^']+'：跳过单引号字符串。
// 3. url\([^\)]+\)：跳过 url(...)。
// 4. (\d*\.?\d+)px：捕获可转换的 px 数值。
const pxReg = /"[^"]+"|'[^']+'|url\([^\)]+\)|(\d*\.?\d+)px/g;

function toFixed(number, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createLRUCache(maxSize = 100) {
  const limit =
    maxSize === Infinity
      ? Infinity
      : Number.isFinite(maxSize) && maxSize > 0
      ? Math.floor(maxSize)
      : 0;
  const cache = new Map();
  return {
    get(key) {
      if (!cache.has(key)) return undefined;
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    },
    set(key, value) {
      if (limit === 0) return;
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size >= limit) {
        cache.delete(cache.keys().next().value);
      }
      cache.set(key, value);
    },
    has(key) {
      return cache.has(key);
    },
  };
}

function createConverter(conversionFn, cacheSize = 100) {
  const cache = createLRUCache(cacheSize);

  return (pixelValue, precision) => {
    const key = `${pixelValue}-${precision}`;
    const cachedValue = cache.get(key);
    if (cachedValue !== undefined) return cachedValue;

    const convertedValue = conversionFn(pixelValue, precision);
    cache.set(key, convertedValue);
    return convertedValue;
  };
}

const matchesRule = (value, rule) => {
  if (typeof value !== "string") return false;
  return typeof rule === "string" ? value.includes(rule) : rule.test(value);
};

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
    cacheSize = 100,
    debug = false,
  } = options;

  const normalizedViewportWidth = normalizePositiveNumber(viewportWidth, 375);
  const normalizedHtmlFontSize = normalizePositiveNumber(htmlFontSize, 37.5);

  const log = debug ? console.log : () => {};

  const toRem = createConverter(
    (px, precision) => `${toFixed(px / normalizedHtmlFontSize, precision)}rem`,
    cacheSize
  );

  const toVw = createConverter(
    (px, precision) =>
      `${toFixed((px / normalizedViewportWidth) * 100, precision)}vw`,
    cacheSize
  );

  const createReplacer = (converter) => (match, pxValue) => {
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

  const isFileExcluded = (file) => isExcluded(file, excludeFiles);
  const isSelectorExcluded = (selector) =>
    isExcluded(selector, excludeSelectors);
  const isPropExcluded = (prop) => isExcluded(prop, excludeProperties);

  return {
    postcssPlugin: "postcss-px-to-unit",
    Once(root) {
      const inputFile = root.source?.input?.file;
      if (isFileExcluded(inputFile)) {
        log(`[px-to-unit] 跳过文件: ${inputFile}`);
        return;
      }

      log(`[px-to-unit] 处理文件: ${inputFile}`);

      root.walkRules((rule) => {
        if (isSelectorExcluded(rule.selector)) {
          log(`[px-to-unit] 跳过选择器: ${rule.selector}`);
          return;
        }

        rule.walkDecls((decl) => {
          if (isPropExcluded(decl.prop)) {
            log(`[px-to-unit] 跳过属性: ${decl.prop}`);
            return;
          }

          const originalValue = decl.value;
          if (!originalValue.includes("px")) return;

          let hasChange = false;
          let vwValue, remValue;

          if (targetUnit === "vw" || targetUnit === "vw&rem") {
            vwValue = originalValue.replace(pxReg, (match, px) => {
              const result = vwReplacer(match, px);
              if (result !== match) hasChange = true;
              return result;
            });

            if (debug && hasChange) {
              log(`[px-to-unit] 转换: "${originalValue}" -> "${vwValue}"`);
            }
          }

          if (targetUnit === "rem" || targetUnit === "vw&rem") {
            remValue = originalValue.replace(pxReg, (match, px) => {
              const result = remReplacer(match, px);
              if (result !== match) hasChange = true;
              return result;
            });

            if (debug && hasChange) {
              log(`[px-to-unit] 转换: "${originalValue}" -> "${remValue}"`);
            }
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
