{{- define "lttl.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "lttl.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "lttl.labels" -}}
app.kubernetes.io/name: {{ include "lttl.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "lttl.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lttl.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "lttl.secretName" -}}
{{ include "lttl.fullname" . }}-secrets
{{- end -}}

{{- define "lttl.configName" -}}
{{ include "lttl.fullname" . }}-config
{{- end -}}

{{- define "lttl.imagePullSecretName" -}}
{{ include "lttl.fullname" . }}-ghcr
{{- end -}}

{{- define "lttl.serviceAccountName" -}}
{{ include "lttl.fullname" . }}-app
{{- end -}}

{{- define "lttl.consulSeedJobName" -}}
{{ include "lttl.fullname" . }}-consul-seed-{{ .Release.Revision }}
{{- end -}}

{{- define "lttl.migrationJobName" -}}
{{ include "lttl.fullname" . }}-migrate-{{ .Release.Revision }}
{{- end -}}

{{- define "lttl.seedJobName" -}}
{{ include "lttl.fullname" . }}-seed-{{ .Release.Revision }}
{{- end -}}

{{- define "lttl.componentName" -}}
{{- printf "%s-%s" (include "lttl.fullname" .root) .name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "lttl.serviceImage" -}}
{{- printf "%s/%s:%s" .root.Values.global.imageRegistry .service.image .root.Values.global.imageTag -}}
{{- end -}}

{{- define "lttl.migrationImage" -}}
{{- printf "%s/%s:%s" .Values.global.imageRegistry .Values.migration.image (default .Values.global.imageTag .Values.migration.imageTag) -}}
{{- end -}}
