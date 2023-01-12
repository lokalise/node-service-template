export interface ErrorReport {
  error: Error
  context?: Record<string, unknown>
}

export type ErrorReporter = {
  report: (errorReport: ErrorReport) => void
}
