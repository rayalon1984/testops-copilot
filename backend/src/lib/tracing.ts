/* eslint-disable no-console */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from '../config';

// Only initialize if enabled
if (config.otel.enabled) {
    const sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: config.otel.serviceName,
        }),
        traceExporter: new OTLPTraceExporter({
            url: config.otel.exporterEndpoint,
        }),
        instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();

    console.log('OpenTelemetry tracing initialized');

    // Gracefully shut down the SDK on process exit
    process.on('SIGTERM', () => {
        sdk
            .shutdown()
            .then(() => console.log('Tracing terminated'))
            .catch((error) => console.log('Error terminating tracing', error))
            .finally(() => process.exit(0));
    });
}
