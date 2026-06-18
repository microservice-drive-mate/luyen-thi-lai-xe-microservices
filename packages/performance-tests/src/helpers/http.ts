import k6http, {
  expectedStatuses,
  type RefinedParams,
  type RefinedResponse,
  type ResponseType,
} from 'k6/http';

export const expected2xxOr400Or401Or403 = expectedStatuses(
  { min: 200, max: 299 },
  400,
  401,
  403,
);
export const expected2xxOr400Or401Or403Or429 = expectedStatuses(
  { min: 200, max: 299 },
  400,
  401,
  403,
  429,
);
export const expected2xxOr404 = expectedStatuses({ min: 200, max: 299 }, 404);
export const expected2xxOr409 = expectedStatuses({ min: 200, max: 299 }, 409);
export const expected2xxOr409Or429 = expectedStatuses(
  { min: 200, max: 299 },
  409,
  429,
);

function generateTraceId(): string {
  const hex = '0123456789abcdef';
  const charAt = (idx: number): string => hex[idx & 15] ?? '0';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += charAt((Math.random() * 4) | 8);
    } else {
      uuid += charAt(Math.floor(Math.random() * 16));
    }
  }
  return uuid;
}

function getCurrentScenario(): string {
  return __ENV.K6_SCENARIO || 'unknown-scenario';
}

function traceHeaders(): Record<string, string> {
  return {
    'X-K6-Trace-Id': generateTraceId(),
    'X-K6-Scenario': getCurrentScenario(),
  };
}

function mergeWithTraceHeaders(
  params?: RefinedParams<ResponseType>,
): RefinedParams<ResponseType> {
  const observabilityHeaders = traceHeaders();
  return {
    ...params,
    headers: {
      ...observabilityHeaders,
      ...(params?.headers as Record<string, string> | undefined),
    },
  };
}

export const http = {
  get<RT extends ResponseType = 'text'>(
    url: string,
    params?: RefinedParams<RT>,
  ): RefinedResponse<RT> {
    return k6http.get<RT>(
      url,
      mergeWithTraceHeaders(params) as RefinedParams<RT>,
    );
  },

  post<RT extends ResponseType = 'text'>(
    url: string,
    body?: Parameters<typeof k6http.post>[1],
    params?: RefinedParams<RT>,
  ): RefinedResponse<RT> {
    return k6http.post<RT>(
      url,
      body,
      mergeWithTraceHeaders(params) as RefinedParams<RT>,
    );
  },

  put<RT extends ResponseType = 'text'>(
    url: string,
    body?: Parameters<typeof k6http.put>[1],
    params?: RefinedParams<RT>,
  ): RefinedResponse<RT> {
    return k6http.put<RT>(
      url,
      body,
      mergeWithTraceHeaders(params) as RefinedParams<RT>,
    );
  },

  patch<RT extends ResponseType = 'text'>(
    url: string,
    body?: Parameters<typeof k6http.patch>[1],
    params?: RefinedParams<RT>,
  ): RefinedResponse<RT> {
    return k6http.patch<RT>(
      url,
      body,
      mergeWithTraceHeaders(params) as RefinedParams<RT>,
    );
  },

  del<RT extends ResponseType = 'text'>(
    url: string,
    body?: Parameters<typeof k6http.del>[1],
    params?: RefinedParams<RT>,
  ): RefinedResponse<RT> {
    return k6http.del<RT>(
      url,
      body,
      mergeWithTraceHeaders(params) as RefinedParams<RT>,
    );
  },
};
