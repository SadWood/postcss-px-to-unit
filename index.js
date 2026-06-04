import valueParser from "postcss-value-parser";

// 支持的目标单位白名单，非法值会在 Once 中触发一次 warning。
const SUPPORTED_TARGET_UNITS = ["vw", "vh", "rem", "vw&rem"];

function toFixed(number, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

// 非负有限数（允许 0），用于 ignoreThreshold。
function normalizeNonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

// 非负有限整数（允许 0），用于 unitPrecision；非法值（NaN/Infinity/负数）回退。
function normalizeNonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
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
    viewportHeight = 667,
    htmlFontSize = 37.5,
    unitPrecision = 5,
    excludeFiles = [],
    excludeSelectors = [],
    excludeProperties = [],
    cacheSize = 100,
    debug = false,
  } = options;

  const normalizedViewportWidth = normalizePositiveNumber(viewportWidth, 375);
  const normalizedViewportHeight = normalizePositiveNumber(viewportHeight, 667);
  const normalizedHtmlFontSize = normalizePositiveNumber(htmlFontSize, 37.5);
  const normalizedUnitPrecision = normalizeNonNegativeInteger(unitPrecision, 5);
  const normalizedIgnoreThreshold = normalizeNonNegativeNumber(
    ignoreThreshold,
    1,
  );

  const isTargetUnitSupported = SUPPORTED_TARGET_UNITS.includes(targetUnit);

  const log = debug ? console.log : () => {};

  const toRem = createConverter(
    (px, precision) => `${toFixed(px / normalizedHtmlFontSize, precision)}rem`,
    cacheSize,
  );

  const toVw = createConverter(
    (px, precision) =>
      `${toFixed((px / normalizedViewportWidth) * 100, precision)}vw`,
    cacheSize,
  );

  const toVh = createConverter(
    (px, precision) =>
      `${toFixed((px / normalizedViewportHeight) * 100, precision)}vh`,
    cacheSize,
  );

  // 基于 postcss-value-parser 做 token 级转换：只转换真正的 px dimension（如
  // 10px、-10px、3.75px），自动跳过字符串、url()、CSS 变量名（var(--size-10px)）
  // 等上下文，并保留 calc(100% - 10px) 这类正常转换。
  const convertValue = (value, converter) => {
    const parsed = valueParser(value);
    let changed = false;

    parsed.walk((node) => {
      if (node.type !== "word") return;

      const dimension = valueParser.unit(node.value);
      // unit 必须严格等于 "px"（大小写敏感，保留 PX 的跳过语义），
      // 同时排除 10pxfoo、--size-10px 这类非纯 dimension。
      if (!dimension || dimension.unit !== "px") return;

      const pixelValue = parseFloat(dimension.number);
      // 阈值按数值幅度比较，使负值（如 -10px）与正值表现一致。
      if (
        !Number.isFinite(pixelValue) ||
        Math.abs(pixelValue) <= normalizedIgnoreThreshold
      ) {
        return;
      }

      node.value = converter(pixelValue, normalizedUnitPrecision);
      changed = true;
    });

    return { changed, value: changed ? parsed.toString() : value };
  };

  const isFileExcluded = (file) => isExcluded(file, excludeFiles);
  const isSelectorExcluded = (selector) =>
    isExcluded(selector, excludeSelectors);
  const isPropExcluded = (prop) => isExcluded(prop, excludeProperties);

  return {
    postcssPlugin: "postcss-px-to-unit",
    Once(root, { result }) {
      if (!isTargetUnitSupported) {
        result.warn(
          `Unsupported targetUnit "${targetUnit}". Expected one of: ` +
            `${SUPPORTED_TARGET_UNITS.join(", ")}. No px conversion was applied.`,
          { plugin: "postcss-px-to-unit" },
        );
        return;
      }

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

          if (targetUnit === "vw&rem") {
            const rem = convertValue(originalValue, toRem);
            if (!rem.changed) return;

            const vw = convertValue(originalValue, toVw);
            decl.value = rem.value;
            decl.after({ prop: decl.prop, value: vw.value });

            if (debug) {
              log(
                `[px-to-unit] 转换: "${originalValue}" -> "${rem.value}" / "${vw.value}"`,
              );
            }
            return;
          }

          const converter =
            targetUnit === "vh" ? toVh : targetUnit === "rem" ? toRem : toVw;
          const { changed, value } = convertValue(originalValue, converter);
          if (!changed) return;

          decl.value = value;
          if (debug) {
            log(`[px-to-unit] 转换: "${originalValue}" -> "${value}"`);
          }
        });
      });
    },
  };
};

export const postcss = true;
