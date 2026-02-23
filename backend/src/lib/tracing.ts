import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from '../config';
import { logger } from '../utils/logger';

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

    logger.info('OpenTelemetry tracing initialized');

    // Gracefully shut down the SDK on process exit
    process.on('SIGTERM', () => {
        sdk
            .shutdown()
            .then(() => logger.info('Tracing terminated'))
            .catch((error) => logger.error('Error terminating tracing', error))
            .finally(() => process.exit(0));
    });
}
