export function consoleLog(output: unknown) {
  // biome-ignore lint/suspicious/noConsole: <biomev2 migration>
  console.info(output)
}

export function consoleError(output: unknown) {
  // biome-ignore lint/suspicious/noConsole: CLI scripts report failures on stderr
  console.error(output)
}
