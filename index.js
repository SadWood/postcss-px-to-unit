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

// 非负有限整数（允许 0），用于 unitPrecision：非法值（NaN/Infinity/负数）回退，
// 合法值再 clamp 到 max，避免超大 precision 让 Math.pow(10, p) 溢出为 Infinity
// 进而产出 NaN（如 unitPrecision: 309）。
function normalizeNonNegativeInteger(value, fallback, max = Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(Math.floor(number), max);
}

// CSS 数值精度上限：超过约 16 位双精度本就无意义，20 足够覆盖所有实际场景
// 且远低于 Math.pow(10, p) 的溢出阈值（p=309）。
const MAX_UNIT_PRECISION = 20;

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
  if (typeof rule === "string") return value.includes(rule);
  // 用 String.prototype.search 而非 RegExp.prototype.test：后者在正则带 g/y
  // 标记时有状态（会推进 lastIndex），对同一规则连续匹配会时真时假，导致
  // 第二个同名 selector/property/file 漏排除。search 不读写 lastIndex，天然规避。
  return value.search(rule) !== -1;
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
  const normalizedUnitPrecision = normalizeNonNegativeInteger(
    unitPrecision,
    5,
    MAX_UNIT_PRECISION,
  );
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
  const valueCache = createLRUCache(cacheSize);

  // 基于 postcss-value-parser 做 token 级转换：只转换真正的 px dimension（如
  // 10px、-10px、3.75px），自动跳过字符串、url()、CSS 变量名（var(--size-10px)）
  // 等上下文，并保留 calc(100% - 10px) 这类正常转换。
  //
  // 接收一个或多个 converter，对同一声明值只 parse 一次：先单次 walk 收集所有
  // 待转 px 节点，再让每个 converter 复用同一 AST 依次输出。vw&rem 因此从两次
  // parse 降为一次。转换结果按原始 value 缓存，重复声明可直接跳过 parse。
  const convertValueWith = (value, converters, mode) => {
    const cacheKey = `${mode}\0${value}`;
    const cachedValue = valueCache.get(cacheKey);
    if (cachedValue !== undefined) return cachedValue;

    const parsed = valueParser(value);
    const targets = [];

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

      targets.push({ node, pixelValue });
    });

    if (targets.length === 0) {
      const convertedValue = {
        changed: false,
        values: converters.map(() => value),
      };
      valueCache.set(cacheKey, convertedValue);
      return convertedValue;
    }

    // 每个 converter 先覆写全部目标节点再 toString；AST 被完整重写，converter
    // 之间互不串味。
    const values = converters.map((converter) => {
      for (const { node, pixelValue } of targets) {
        node.value = converter(pixelValue, normalizedUnitPrecision);
      }
      return parsed.toString();
    });

    const convertedValue = { changed: true, values };
    valueCache.set(cacheKey, convertedValue);
    return convertedValue;
  };

  const convertValue = (value, converter) => {
    const { changed, values } = convertValueWith(
      value,
      [converter],
      targetUnit,
    );
    return { changed, value: values[0] };
  };

  const isFileExcluded = (file) => isExcluded(file, excludeFiles);
  const isSelectorExcluded = (selector) =>
    isExcluded(selector, excludeSelectors);
  const isPropExcluded = (prop) => isExcluded(prop, excludeProperties);

  const transformDeclaration = (decl) => {
    if (isPropExcluded(decl.prop)) {
      log(`[px-to-unit] 跳过属性: ${decl.prop}`);
      return;
    }

    const originalValue = decl.value;
    if (!originalValue.includes("px")) return;

    if (targetUnit === "vw&rem") {
      // 单次 parse 同时产出 rem 与 vw，避免对同一声明值重复解析。
      const { changed, values } = convertValueWith(
        originalValue,
        [toRem, toVw],
        targetUnit,
      );
      if (!changed) return;

      const [remValue, vwValue] = values;
      decl.value = remValue;
      decl.cloneAfter({ value: vwValue });

      if (debug) {
        log(
          `[px-to-unit] 转换: "${originalValue}" -> "${remValue}" / "${vwValue}"`,
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
  };

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
          transformDeclaration(decl);
        });
      });

      root.walkAtRules((atrule) => {
        atrule.each((node) => {
          if (node.type === "decl") transformDeclaration(node);
        });
      });
    },
  };
};

export const postcss = true;
