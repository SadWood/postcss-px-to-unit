// 发布前 smoke：验证 package.json 的 exports 映射对消费者真实可解析，并跑一次
// 真实转换。借助 Node 的 self-reference（包含 exports 字段时可按包名解析自身），
// 无需先 npm pack / 安装到临时目录。任一断言失败即非零退出，供 prepublishOnly 拦截。
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import postcss from "postcss";

const require = createRequire(import.meta.url);
const PKG = "postcss-px-to-unit";

function ok(label) {
  console.log(`  ✓ ${label}`);
}

// 1. ESM import 主入口（exports "."）
const main = await import(PKG);
assert.equal(typeof main.default, "function", 'import "." default 应为函数');
assert.equal(main.postcss, true, 'import "." 应导出 postcss: true');
ok(`ESM import "${PKG}"`);

// 2. ESM import 子路径入口（exports "./index.js"）
const sub = await import(`${PKG}/index.js`);
assert.equal(
  typeof sub.default,
  "function",
  'import "./index.js" default 应为函数',
);
ok(`ESM import "${PKG}/index.js"`);

// 3. package.json 子路径可解析（exports "./package.json"），CJS require 始终可用
const pkgJson = require(`${PKG}/package.json`);
assert.equal(pkgJson.name, PKG, "require package.json name 应匹配");
ok(`require "${PKG}/package.json"`);

// 4. CJS require 主模块：纯 ESM 包仅在 Node 支持 require(ESM) 时可用
//    （Node 20.19+/22.12+/23+）。旧 Node 抛 ERR_REQUIRE_ESM 属预期，不算失败。
try {
  const cjs = require(PKG);
  const factory = cjs.default ?? cjs;
  assert.equal(typeof factory, "function", "require 主模块 default 应为函数");
  ok(`require "${PKG}" (require(ESM) supported on Node ${process.version})`);
} catch (err) {
  if (err.code === "ERR_REQUIRE_ESM") {
    ok(
      `require "${PKG}" → ERR_REQUIRE_ESM (expected: pure ESM on Node ${process.version})`,
    );
  } else {
    throw err;
  }
}

// 5. 真实转换：经 postcss 跑一遍，确认导出的工厂可用且产出正确
const result = await postcss([main.default({ targetUnit: "vw" })]).process(
  ".a{width:10px}",
  { from: undefined },
);
assert.equal(result.css, ".a{width:2.66667vw}", "真实转换输出应匹配");
assert.equal(result.warnings().length, 0, "不应产生 warning");
ok("real conversion via postcss");

console.log("\npackage verify passed.");
