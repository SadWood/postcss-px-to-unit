# postcss-px-to-unit

An efficient PostCSS plugin for converting px units to relative length units (vw / vh / rem). This project has been refactored with performance optimizations, providing faster processing speed and more reliable conversion results.

## Install

```shell
# npm
npm install postcss-px-to-unit -D

# yarn
yarn add postcss-px-to-unit -D

# pnpm
pnpm add postcss-px-to-unit -D
```

## Usage

```javascript
// webpack.config.js
import PxToUnit from 'postcss-px-to-unit';

...
{
  loader: 'postcss-loader',
  plugins: [
    PxToUnit({
      // options
    })
  ]
}
...
```

```javascript
// vite.config.js
import PxToUnit from "postcss-px-to-unit";

export default defineConfig(() => ({
  // ...
  css: {
    postcss: {
      plugins: [
        PxToUnit({
          // options
        }),
      ],
    },
  },
  // ...
}));
```

## Options

```javascript
PxToUnit({
  targetUnit: "vw",
  ignoreThreshold: 1,
  viewportWidth: 375,
  viewportHeight: 667,
  htmlFontSize: 37.5,
  unitPrecision: 5,
  excludeFiles: [],
  excludeSelectors: [],
  excludeProperties: [],
  cacheSize: 100,
  debug: false,
});
```

| Option            | Default | Description                                                                |
| ----------------- | :-----: | :------------------------------------------------------------------------- |
| targetUnit        |  'vw'   | Target relative length unit. Support 'vw', 'vh', 'rem' and 'vw&rem'        |
| ignoreThreshold   |    1    | px values less than this threshold won't be converted                      |
| viewportWidth     |   375   | Base viewport width (for targetUnit: 'vw')                                 |
| viewportHeight    |   667   | Base viewport height (for targetUnit: 'vh')                                |
| htmlFontSize      |  37.5   | Base html font-size (for targetUnit: 'rem')                                |
| unitPrecision     |    5    | Unit value precision                                                       |
| excludeFiles      |   []    | Exclude file paths, supports regexp. (example: [/node_modules/])           |
| excludeSelectors  |   []    | Exclude CSS selectors, supports string and regexp. (example: ['.ignore'])  |
| excludeProperties |   []    | Exclude CSS properties, supports string and regexp. (example: [/^width$/]) |
| cacheSize         |   100   | Max number of cached conversion results (LRU)                              |
| debug             |  false  | Print debug logs of skipped/converted values                               |

### targetUnit: 'vh' mode

Use the 'vh' mode when a value should scale against the viewport height.

```css
/* Input */
.test {
  height: 66.7px;
}

/* Output */
.test {
  height: 10vh;
}
```

### targetUnit: 'vw&rem' mode

If you want to use vw units but are concerned about browser compatibility, you can use the 'vw&rem' mode. For example:

```css
/* Input */
.test {
  border: 3.75px solid #fff;
}

/* Output */
.test {
  border: 0.1rem solid #fff;
  border: 1vw solid #fff;
}
```

For browsers that don't support vw, it will automatically use rem for layout.

**Note: If you need to limit max/min width of the layout, this mode is not suitable for you**

### PX case sensitivity

The conversion process is case sensitive. You can use PX to avoid conversion in special cases.

```text
/* Input */
.test {
  padding: 3.75px 3.75PX;
}

/* Output */
.test {
  padding: 1vw 3.75PX;
}
```

## Performance Optimizations

Compared to the original version, this project includes the following optimizations:

- More efficient CSS parsing and processing logic
- Reduction of unnecessary calculations and conversion operations
- Optimized file processing workflow, improving processing speed for large projects

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
