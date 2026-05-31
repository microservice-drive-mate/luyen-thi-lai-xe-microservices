param(
  [string]$Repo = "",
  [string]$ValuesPath = "charts/luyen-thi-lai-xe/values-gcp.local.yaml",
  [string]$KubeconfigPath = "kubeconfig-gcp.yaml",
  [string]$GhPath = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Resolve-GhPath {
  if (-not [string]::IsNullOrWhiteSpace($GhPath)) {
    return $GhPath
  }

  $command = Get-Command gh -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    "$env:ProgramFiles\GitHub CLI\gh.exe",
    "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe",
    "$env:ProgramFiles\GitHub CLI\bin\gh.exe",
    "$env:LOCALAPPDATA\Programs\GitHub CLI\bin\gh.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "Required command not found: gh"
}

function Get-RepoFromGit {
  $remote = (git remote get-url origin).Trim()
  if ($remote -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(\.git)?$") {
    return "$($Matches.owner)/$($Matches.repo)"
  }

  throw "Unable to infer GitHub repository from origin remote: $remote"
}

function Get-EnvFileValues {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -eq 2) {
      $values[$parts[0]] = $parts[1]
    }
  }

  return $values
}

function Assert-Value {
  param(
    [string]$Name,
    [AllowEmptyString()][string]$Value
  )

  $placeholderPattern = "^(|change-me|replace-with-.*|.*<.*>.*)$"
  if ($null -eq $Value -or $Value.Trim() -match $placeholderPattern) {
    throw "Missing or placeholder value for $Name"
  }
}

function Set-GhSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  Assert-Value -Name $Name -Value $Value

  if ($DryRun) {
    Write-Host "[dry-run] secret $Name"
    return
  }

  $Value | & $script:GhExecutable secret set $Name --repo $Repo 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "gh secret set failed for $Name"
  }
  Write-Host "Set secret $Name"
}

function Set-GhVariable {
  param(
    [string]$Name,
    [string]$Value
  )

  Assert-Value -Name $Name -Value $Value

  if ($DryRun) {
    Write-Host "[dry-run] variable $Name=$Value"
    return
  }

  & $script:GhExecutable variable set $Name --repo $Repo --body $Value | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "gh variable set failed for $Name"
  }
  Write-Host "Set variable $Name=$Value"
}

Assert-Command git
Assert-Command node
if (-not $DryRun) {
  $script:GhExecutable = Resolve-GhPath
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
  $Repo = Get-RepoFromGit
}

if (-not (Test-Path $ValuesPath)) {
  throw "Values file not found: $ValuesPath"
}

if (-not (Test-Path $KubeconfigPath)) {
  throw "Kubeconfig file not found: $KubeconfigPath"
}

$valuesJson = node -e @"
const fs = require('node:fs');
const yaml = require('js-yaml');
const values = yaml.load(fs.readFileSync(process.argv[1], 'utf8'));
process.stdout.write(JSON.stringify(values));
"@ $ValuesPath

$values = $valuesJson | ConvertFrom-Json
$envFile = Get-EnvFileValues ".env"

$apiScheme = "https"
if ($values.config.gatewayPublicUrl -match "^(?<scheme>https?)://") {
  $apiScheme = $Matches.scheme
}

$secretValues = @{
  STAGING_KUBE_CONFIG_B64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $KubeconfigPath)))
  GHCR_PULL_USERNAME = if ($env:GHCR_PULL_USERNAME) { $env:GHCR_PULL_USERNAME } else { $values.imagePullSecret.username }
  GHCR_PULL_TOKEN = if ($env:GHCR_PULL_TOKEN) { $env:GHCR_PULL_TOKEN } else { $values.imagePullSecret.token }
  STAGING_POSTGRES_PASSWORD = if ($values.secrets.postgresPassword) { $values.secrets.postgresPassword } else { $envFile.POSTGRES_PASSWORD }
  STAGING_RABBITMQ_PASSWORD = if ($values.secrets.rabbitmqPassword) { $values.secrets.rabbitmqPassword } else { $envFile.RABBITMQ_DEFAULT_PASS }
  STAGING_RABBITMQ_ERLANG_COOKIE = if ($values.secrets.rabbitmqErlangCookie) { $values.secrets.rabbitmqErlangCookie } else { $envFile.RABBITMQ_ERLANG_COOKIE }
  STAGING_KEYCLOAK_ADMIN_PASSWORD = if ($values.secrets.keycloakAdminPassword) { $values.secrets.keycloakAdminPassword } else { $envFile.KEYCLOAK_ADMIN_PASSWORD }
  STAGING_KEYCLOAK_CLIENT_SECRET = if ($values.secrets.keycloakClientSecret) { $values.secrets.keycloakClientSecret } else { $envFile.KEYCLOAK_CLIENT_SECRET }
  STAGING_STORAGE_ACCOUNT_NAME = if ($values.secrets.storageAccountName) { $values.secrets.storageAccountName } else { $envFile.STORAGE_ACCOUNT_NAME }
  STAGING_STORAGE_ACCOUNT_KEY = if ($values.secrets.storageAccountKey) { $values.secrets.storageAccountKey } else { $envFile.STORAGE_ACCOUNT_KEY }
}

$variableValues = @{
  GCP_AUTO_DEPLOY_ENABLED = "true"
  STAGING_DEPLOY_ENABLED = "true"
  STAGING_API_HOST = $values.ingress.apiHost
  STAGING_AUTH_HOST = $values.ingress.authHost
  STAGING_FRONTEND_ORIGIN = $values.config.frontendOrigin
  STAGING_API_SCHEME = $apiScheme
  STAGING_SEED_ENABLED = if ($values.seed.enabled) { "true" } else { "false" }
}

Write-Host "Target repository: $Repo"
Write-Host "Source values: $ValuesPath"
Write-Host "Source kubeconfig: $KubeconfigPath"

foreach ($entry in $variableValues.GetEnumerator() | Sort-Object Name) {
  Set-GhVariable -Name $entry.Key -Value ([string]$entry.Value)
}

foreach ($entry in $secretValues.GetEnumerator() | Sort-Object Name) {
  Set-GhSecret -Name $entry.Key -Value ([string]$entry.Value)
}

Write-Host "Done."
