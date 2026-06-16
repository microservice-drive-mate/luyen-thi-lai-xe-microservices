# OpenTelemetry And Jaeger Tracing

This guide keeps tracing aligned with the Azure AKS runtime.

## Current Scope

- Application services expose OpenTelemetry traces when tracing config is enabled.
- Jaeger can run locally for development, or inside AKS for a demo if the cluster has enough resources.
- For a small student AKS cluster, keep Jaeger optional to avoid memory pressure.

## Local Demo

```powershell
docker compose -f docker-compose.infra.yml up -d jaeger
```

Open:

```text
http://localhost:16686
```

## AKS Demo Option

If tracing is enabled in the Helm values, verify pods and service:

```powershell
kubectl get deploy,svc,pod -n staging | Select-String jaeger
kubectl port-forward -n staging svc/luyen-thi-lai-xe-jaeger 16686:16686
```

Open:

```text
http://localhost:16686
```

## Demo Talking Point

> Metrics tell us something is slow, logs explain local service behavior, and traces show the path of one request across multiple microservices.
