import fs from "fs";
import path from "path";
import postcss from "postcss";
import { fileURLToPath } from "url";
import PxToUnit from "../index.js";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let inputFile = path.resolve(__dirname, "./input/test.css");

// 检查文件是否存在
if (!fs.existsSync(inputFile)) {
  console.error(`文件不存在: ${inputFile}`);
  process.exit(1);
}

postcss([
  PxToUnit({
    targetUnit: "vw&rem",
  }),
])
  .process(fs.readFileSync(inputFile), {
    from: inputFile,
  })
  .then(function (result) {
    console.log(result.css);
  })
  .catch((error) => {
    console.error("处理CSS过程中发生错误:", error);
  });
