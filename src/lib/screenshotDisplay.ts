/** CSS size so 1 bitmap pixel = 1 device pixel (the original screenshot on this screen). */
export function screenshotCssSize(
  naturalWidth: number,
  naturalHeight: number,
  devicePixelRatio: number,
): { width: number; height: number } {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return {
    width: naturalWidth / dpr,
    height: naturalHeight / dpr,
  }
}
