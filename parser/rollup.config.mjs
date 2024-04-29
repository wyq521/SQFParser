import buble from "@rollup/plugin-buble"
import {promises as fs} from "node:fs"

const copy = (from, to) => ({
  async writeBundle() { await fs.writeFile(to, await fs.readFile(from)) }
})

export default [
  {
    input: "parser/src/index.js",
    output: [
      {
        file: "parser/dist/parser.js",
        format: "umd",
        name: "parser"
      },
      {
        file: "parser/dist/parser.mjs",
        format: "es"
      }
    ],
    plugins: [
      buble({transforms: {dangerousForOf: true}})
      // copy("acorn/src/acorn.d.ts", "acorn/dist/acorn.d.ts"),
      // copy("acorn/src/acorn.d.ts", "acorn/dist/acorn.d.mts")
    ]
  }
  // {
  //   external: ["parser", "fs", "path"],
  //   input: "parser/src/bin/parser.js",
  //   output: {
  //     file: "parser/dist/bin.js",
  //     format: "cjs",
  //     paths: {parser: "./parser.js"}
  //   },
  //   plugins: [
  //     buble({transforms: {dangerousForOf: true}})
  //   ]
  // }
]
