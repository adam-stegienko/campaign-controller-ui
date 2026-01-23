import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import { diag, DiagConsoleLogger, DiagLogLevel, trace } from "@opentelemetry/api";
import { ZoneContextManager } from "@opentelemetry/context-zone";

// Export tracer at top-level; it will be assigned during init when not in tests
export let tracer;

// Avoid initializing during tests (extra guard)
if (process.env.NODE_ENV === "test") {
  // Do nothing in test environment
} else {
  // Lower verbosity in dev; keep quiet in production
  if (process.env.NODE_ENV === "development") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  }

  const collectorUrl =
    process.env.REACT_APP_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    "http://localhost:4318/v1/traces"; // Default OTLP HTTP endpoint

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: "campaign-controller-ui",
    }),
  });

  const exporter = new OTLPTraceExporter({ url: collectorUrl });
  if (typeof provider.addSpanProcessor === "function") {
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  } else {
    // Avoid crashing in dev if SDK version lacks addSpanProcessor
    console.warn(
      "OpenTelemetry: provider.addSpanProcessor is unavailable; spans will not be exported."
    );
  }

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  // Configure auto-instrumentations
  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new UserInteractionInstrumentation(),
      new FetchInstrumentation({
        // Allow trace header propagation to your APIs (adjust as needed)
        propagateTraceHeaderCorsUrls: [
          "http://127.0.0.1:8000",
          // dev/stage local domains
          /^https?:\/\/campaign-controller-dev\.apps\.stegienko\.local\b/,
          /^https?:\/\/campaign-controller-stage\.apps\.steigenko\.local\b/,
        ],
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [
          "http://127.0.0.1:8000",
          /^https?:\/\/campaign-controller-dev\.apps\.stegienko\.local\b/,
          /^https?:\/\/campaign-controller-stage\.apps\.steigenko\.local\b/,
        ],
      }),
    ],
  });

  // Assign tracer for manual spans in components
  // Example usage: const span = tracer.startSpan("ui.click.create"); span.end();
  tracer = trace.getTracer("campaign-controller-ui");
}
