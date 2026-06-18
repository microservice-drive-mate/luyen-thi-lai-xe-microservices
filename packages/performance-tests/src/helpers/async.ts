import { check } from 'k6';
import { Trend } from 'k6/metrics';
import ws from 'k6/ws';

const asyncLatencyTrend = new Trend('async_e2e_latency_ms', true);

export interface WsListenOptions {
  url: string;
  namespace: string;
  token: string;
  expectedEvent: string;
  conditionFn?: (payload: unknown) => boolean;
  timeoutMs?: number;
}

export function measureSocketIoEventLatency(
  options: WsListenOptions,
  trigger: () => void,
): boolean {
  const {
    url,
    namespace,
    token,
    expectedEvent,
    conditionFn,
    timeoutMs = 5000,
  } = options;
  const wsUrl = `${url}/?EIO=4&transport=websocket`;

  let eventReceived = false;
  let triggered = false;
  let startedAt = 0;
  const namespaceConnectPacket = `40${namespace}`;
  const namespaceEventPacket = `42${namespace},`;
  const debugWs = __ENV.K6_WS_DEBUG === 'true';

  const triggerOnce = (): void => {
    if (triggered) return;
    triggered = true;
    startedAt = Date.now();
    trigger();
  };

  const res = ws.connect(
    wsUrl,
    { headers: { Authorization: `Bearer ${token}` } },
    (socket) => {
      socket.on('open', () => {
        socket.send(`40${namespace},${JSON.stringify({ token })}`);
      });

      socket.on('message', (msg) => {
        if (typeof msg !== 'string') return;

        if (debugWs && (msg.startsWith('40') || msg.startsWith('42'))) {
          console.log(`[ws] ${msg}`);
        }

        if (msg === '2') {
          socket.send('3');
          return;
        }

        if (msg.startsWith(namespaceConnectPacket)) {
          triggerOnce();
          return;
        }

        if (!msg.startsWith(namespaceEventPacket)) return;

        try {
          const payloadText = msg.substring(namespaceEventPacket.length);
          const [eventName, payload] = JSON.parse(payloadText) as [
            string,
            unknown,
          ];

          if (eventName === 'notification.connected') {
            triggerOnce();
            return;
          }

          if (
            eventName === expectedEvent &&
            triggered &&
            (!conditionFn || conditionFn(payload))
          ) {
            eventReceived = true;
            asyncLatencyTrend.add(Date.now() - startedAt, {
              event: expectedEvent,
            });
            socket.close();
          }
        } catch {
          return;
        }
      });

      socket.on('error', (error) => {
        if (error.error() !== 'websocket: close sent') {
          console.error(`WebSocket error: ${error.error()}`);
        }
      });

      socket.setTimeout(() => {
        socket.close();
      }, timeoutMs);
    },
  );

  if (!triggered) {
    triggerOnce();
  }

  check(res, {
    [`WebSocket E2E Received: ${expectedEvent}`]: () => eventReceived,
  });

  return eventReceived;
}
