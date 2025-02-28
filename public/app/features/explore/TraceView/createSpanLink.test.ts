import { DataSourceInstanceSettings, MutableDataFrame } from '@grafana/data';
import { setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { TraceSpan } from '@jaegertracing/jaeger-ui-components';
import { TraceToMetricsOptions } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

import { TraceToLogsOptions } from '../../../core/components/TraceToLogs/TraceToLogsSettings';
import { LinkSrv, setLinkSrv } from '../../panel/panellinks/link_srv';
import { TemplateSrv } from '../../templating/template_srv';

import { createSpanLinkFactory } from './createSpanLink';

describe('createSpanLinkFactory', () => {
  it('returns no links if there is no data source uid', () => {
    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory({ splitOpenFn: splitOpenFn });
    const links = createLink!(createTraceSpan());
    expect(links?.logLinks).toBeUndefined();
    expect(links?.metricLinks).toBeUndefined();
    expect(links?.traceLinks).toHaveLength(0);
  });

  describe('should return loki link', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings(uid: string): DataSourceInstanceSettings | undefined {
          return { uid: 'loki1', name: 'loki1', type: 'loki' } as any;
        },
      } as any);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('with default keys when tags not configured', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());
      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('with tags that passed in and without tags that are not in the span', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip', 'newTag'],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );
      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('from tags and process tags as well', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip', 'host'],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );
      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\", host=\\"host\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('with adjusted start and end time', () => {
      const createLink = setupSpanLinkFactory({
        spanStartTimeShift: '1m',
        spanEndTimeShift: '1m',
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );
      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:01:00.000Z","to":"2020-10-14T01:01:01.000Z"},"datasource":"loki1","queries":[{"expr":"{hostname=\\"hostname1\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('filters by trace and span ID', () => {
      const createLink = setupSpanLinkFactory({
        filterBySpanID: true,
        filterByTraceID: true,
      });
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"} |=\\"7946b05c2e2e4e5a\\" |=\\"6605c7b08e715d6c\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('creates link from dataFrame', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        dataFrame: new MutableDataFrame({
          fields: [
            { name: 'traceID', values: ['testTraceId'] },
            {
              name: 'spanID',
              config: { links: [{ title: 'link', url: '${__data.fields.spanID}' }] },
              values: ['testSpanId'],
            },
          ],
        }),
      });
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe('testSpanId');
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        mapTagNamesEnabled: true,
        mappedTags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{service=\\"serviceName\\", pod=\\"podName\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('handles incomplete renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        mapTagNamesEnabled: true,
        mappedTags: [
          { key: 'service.name', value: '' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{service.name=\\"serviceName\\", pod=\\"podName\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('handles empty queries', () => {
      const createLink = setupSpanLinkFactory({
        tags: [],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );
      expect(links?.logLinks).toBeUndefined();
    });
  });

  describe('should return splunk link', () => {
    const splunkUID = 'splunkUID';

    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings(uid: string): DataSourceInstanceSettings | undefined {
          return { uid: splunkUID, name: 'Splunk 8', type: 'grafana-splunk-datasource' } as any;
        },
      } as any);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('the `query` keyword is used in the link rather than `expr` that loki uses', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toContain(`${encodeURIComponent('datasource":"Splunk 8","queries":[{"query"')}`);
      expect(linkDef!.href).not.toContain(`${encodeURIComponent('datasource":"Splunk 8","queries":[{"expr"')}`);
    });

    it('automatically timeshifts the timerange by one second in a splunk query', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toContain(
        `${encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"}')}`
      );
      expect(linkDef!.href).not.toContain(
        `${encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:00.000Z"}')}`
      );
    });

    it('formats query correctly if filterByTraceID and or filterBySpanID is true', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
        filterByTraceID: true,
        filterBySpanID: true,
      });

      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"cluster=\\"cluster1\\" hostname=\\"hostname1\\" \\"7946b05c2e2e4e5a\\" \\"6605c7b08e715d6c\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('should format one tag correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip'],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [{ key: 'ip', value: '192.168.0.1' }],
          },
        })
      );

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"ip=\\"192.168.0.1\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('should format multiple tags correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip', 'hostname'],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"hostname=\\"hostname1\\" ip=\\"192.168.0.1\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        mapTagNamesEnabled: true,
        mappedTags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.logLinks?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"service=\\"serviceName\\" pod=\\"podName\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });
  });

  describe('should return metric link', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings(uid: string): DataSourceInstanceSettings | undefined {
          return { uid: 'prom1', name: 'prom1', type: 'prometheus' } as any;
        },
      } as any);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('returns query with span', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        traceToMetricsOptions: {
          datasourceUid: 'prom1',
          query: 'customQuery',
        },
      });
      expect(createLink).toBeDefined();

      const links = createLink!(createTraceSpan());
      const linkDef = links?.metricLinks?.[0];

      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"prom1","queries":[{"expr":"customQuery","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('uses default query if no query specified', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        traceToMetricsOptions: {
          datasourceUid: 'prom1',
        } as TraceToMetricsOptions,
      });
      expect(createLink).toBeDefined();

      const links = createLink!(createTraceSpan());
      const linkDef = links?.metricLinks?.[0];

      expect(linkDef).toBeDefined();
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"prom1","queries":[{"expr":"histogram_quantile(0.5, sum(rate(tempo_spanmetrics_latency_bucket{operation=\\"operation\\"}[5m])) by (le))","refId":""}],"panelsState":{}}'
        )}`
      );
    });
  });

  describe('should return span links', () => {
    beforeAll(() => {
      setDataSourceSrv(new DatasourceSrv());
      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('ignores parent span link', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({ references: [{ refType: 'CHILD_OF', spanID: 'parent', traceID: 'traceID' }] })
      );

      const traceLinks = links?.traceLinks;
      expect(traceLinks).toBeDefined();
      expect(traceLinks).toHaveLength(0);
    });

    it('returns links for references and subsidiarilyReferencedBy references', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          references: [
            {
              refType: 'FOLLOWS_FROM',
              spanID: 'span1',
              traceID: 'traceID',
              span: { operationName: 'SpanName' } as any,
            },
          ],
          subsidiarilyReferencedBy: [{ refType: 'FOLLOWS_FROM', spanID: 'span3', traceID: 'traceID2' }],
        })
      );

      const traceLinks = links?.traceLinks;
      expect(traceLinks).toBeDefined();
      expect(traceLinks).toHaveLength(2);
      expect(traceLinks![0]).toEqual(
        expect.objectContaining({
          href: 'traceID-span1',
          title: 'SpanName',
        })
      );
      expect(traceLinks![1]).toEqual(
        expect.objectContaining({
          href: 'traceID2-span3',
          title: 'View linked span',
        })
      );
    });
  });
});

function setupSpanLinkFactory(options: Partial<TraceToLogsOptions> = {}, datasourceUid = 'lokiUid') {
  const splitOpenFn = jest.fn();
  return createSpanLinkFactory({
    splitOpenFn,
    traceToLogsOptions: {
      datasourceUid,
      ...options,
    },
    createFocusSpanLink: (traceId, spanId) => {
      return {
        href: `${traceId}-${spanId}`,
      } as any;
    },
  });
}

function createTraceSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    spanID: '6605c7b08e715d6c',
    traceID: '7946b05c2e2e4e5a',
    processID: 'processId',
    operationName: 'operation',
    logs: [],
    startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
    duration: 1000 * 1000,
    flags: 0,
    hasChildren: false,
    dataFrameRowIndex: 0,
    tags: [
      {
        key: 'host',
        value: 'host',
      },
    ],
    process: {
      serviceName: 'test service',
      tags: [
        {
          key: 'cluster',
          value: 'cluster1',
        },
        {
          key: 'hostname',
          value: 'hostname1',
        },
        {
          key: 'label2',
          value: 'val2',
        },
      ],
    },
    ...overrides,
  } as any;
}
