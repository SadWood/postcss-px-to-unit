// 覆盖率门禁：阈值略低于当前 V8 覆盖率实际（Stmts 97.53 / Branch 95.69 /
// Funcs 100 / Lines 97.53），既能拦住后续改动把关键分支覆盖降下来，又不会
// 一上来就因小数波动变红。覆盖范围锁定到发布产物 index.js。
export default {
  collectCoverageFrom: ["index.js"],
  coverageProvider: "v8",
  transform: {},
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
};
