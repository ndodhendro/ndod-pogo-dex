/** Let React paint before the next CPU-heavy restore step. */
export function yieldUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}
