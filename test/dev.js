import fs from "fs";
import path from "path";
import postcss from "postcss";
import PxToUnit from "../index";

let inputFile = path.resolve(__dirname, "./input/test.css");

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
  });
