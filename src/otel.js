// Initialize OpenTelemetry only outside of test runs
if (process.env.NODE_ENV !== "test") {
  // Importing init side-effects early ensures document-load is captured
  import("./otel.init");
}
