// 覆盖率门禁：阈值略低于当前实际（Stmts 95.83 / Branch 90.9 / Funcs 96.15 /
// Lines 95.32），既能拦住后续改动把关键分支覆盖降下来，又不会一上来就因小数
// 波动变红。覆盖范围锁定到发布产物 index.js，排除测试/脚本等非产物文件。
export default {
  collectCoverageFrom: ["index.js"],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
};
