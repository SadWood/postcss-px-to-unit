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

// 创建LRU缓存，限制缓存大小
function createLRUCache(maxSize = 100) {
  const cache = new Map();
  return {
    get(key) {
      if (!cache.has(key)) return undefined;
      const value = cache.get(key);
      // 访问时将项移到最近使用（删除后重新添加）
      cache.delete(key);
      cache.set(key, value);
      return value;
    },
    set(key, value) {
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size >= maxSize) {
        // 删除最旧的项（Map的第一个条目）
        cache.delete(cache.keys().next().value);
      }
      cache.set(key, value);
    },
    has(key) {
      return cache.has(key);
    },
  };
}

// 创建带缓存的转换函数
function createConverter(conversionFn, cacheSize = 100) {
  const cache = createLRUCache(cacheSize);

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
    cacheSize = 100, // 新增：缓存大小配置
    debug = false, // 新增：调试模式配置
  } = options;

  // 创建logger函数
  const log = debug ? console.log : () => {};

  // 创建缓存的单位转换器，使用自定义缓存大小
  const toRem = createConverter(
    (px, precision) => `${toFixed(px / htmlFontSize, precision)}rem`,
    cacheSize
  );

  const toVw = createConverter(
    (px, precision) => `${toFixed((px / viewportWidth) * 100, precision)}vw`,
    cacheSize
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

  // 优化：预编译排除规则检查函数
  const isFileExcluded = (file) => isExcluded(file, excludeFiles);
  const isSelectorExcluded = (selector) =>
    isExcluded(selector, excludeSelectors);
  const isPropExcluded = (prop) => isExcluded(prop, excludeProperties);

  return {
    postcssPlugin: "postcss-px-to-unit",
    Once(root) {
      const inputFile = root.source.input.file;
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
