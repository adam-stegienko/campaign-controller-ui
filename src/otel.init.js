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
if (process.env.NODE_ENV !== "test") {
  (async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
      }

      // Try loading runtime config
      let cfg = null;
      try {
        const res = await fetch("/config.json", { cache: "no-cache" });
        if (res.ok) {
          cfg = await res.json();
        }
      } catch (_) {
        // ignore config load errors; fall back to env/defaults
      }

      const otelCfg = cfg?.otel || {};
      const enabled = otelCfg.enabled !== undefined ? !!otelCfg.enabled : true;
      if (!enabled) {
        return; // Tracing disabled via config
      }

      const serviceName =
        otelCfg.serviceName || "campaign-controller-ui";

      const collectorUrl =
        otelCfg.tracesEndpoint ||
        process.env.REACT_APP_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
        "http://localhost:4318/v1/traces"; // Default OTLP HTTP endpoint

      const originsFromConfig = Array.isArray(otelCfg.propagateOrigins)
        ? otelCfg.propagateOrigins
        : [
            "http://127.0.0.1:8000"
          ];

      // Convert string origins to regex for http/https matching
      const originPatterns = originsFromConfig.map((o) => {
        try {
          const escaped = o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`^https?:\\/\\/${escaped}\\b`);
        } catch (_) {
          return o; // Fallback to raw string if regex fails
        }
      });

      const provider = new WebTracerProvider({
        resource: resourceFromAttributes({
          [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        }),
      });

      const exporter = new OTLPTraceExporter({ url: collectorUrl });
      if (typeof provider.addSpanProcessor === "function") {
        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      } else {
        console.warn(
          "OpenTelemetry: provider.addSpanProcessor is unavailable; spans will not be exported."
        );
      }

      provider.register({ contextManager: new ZoneContextManager() });

      registerInstrumentations({
        instrumentations: [
          new DocumentLoadInstrumentation(),
          new UserInteractionInstrumentation(),
          new FetchInstrumentation({
            propagateTraceHeaderCorsUrls: originPatterns,
          }),
          new XMLHttpRequestInstrumentation({
            propagateTraceHeaderCorsUrls: originPatterns,
          }),
        ],
      });

      tracer = trace.getTracer(serviceName);
    } catch (err) {
      console.warn("OpenTelemetry init failed:", err);
    }
  })();
}
