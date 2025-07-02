export function consoleLog(output: unknown) {
  // biome-ignore lint/suspicious/noConsole: <biomev2 migration>
  console.info(output)
}
