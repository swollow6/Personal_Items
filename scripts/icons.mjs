import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = x / size,
        py = y / size
      const box = px > 0.28 && px < 0.72 && py > 0.3 && py < 0.72
      const edge =
        box &&
        (px < 0.3 ||
          px > 0.7 ||
          py < 0.32 ||
          py > 0.7 ||
          Math.abs(px - 0.5) < 0.012 ||
          (py < 0.43 && Math.abs(py - (0.32 + 0.5 * Math.abs(px - 0.5))) < 0.014))
      const c = edge ? [255, 255, 255] : [56, 102, 77]
      const i = (size * y + x) * 4
      png.data[i] = c[0]
      png.data[i + 1] = c[1]
      png.data[i + 2] = c[2]
      png.data[i + 3] = 255
    }
  writeFileSync(`public/icons/icon-${size}.png`, PNG.sync.write(png))
}
