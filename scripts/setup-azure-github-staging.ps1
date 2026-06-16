param(
  [string]$Repo = "",
  [string]$AppDisplayName = "github-lttl-azure-staging",
  [string]$ResourceGroup = "rg-lttl-staging-sea",
  [string]$AksCluster = "aks-lttl-staging",
  [string]$ApiHost = "api.52.139.233.166.nip.io",
  [string]$AuthHost = "auth.52.139.233.166.nip.io",
  [string]$FrontendOrigin = "http://localhost:5173",
  [string]$ApiScheme = "http",
  [string]$StagingSeedEnabled = "true",
  [string]$GhcrOwner = "",
  [string]$GhcrPullUsername = "",
  [string]$GhcrPullToken = "",
  [string]$PostgresPassword = "change-me",
  [string]$RabbitmqPassword = "change-me",
  [string]$RabbitmqErlangCookie = "change-me-rabbitmq-cookie",
  [string]$KeycloakAdminPassword = "change-me",
  [string]$KeycloakClientSecret = "change-me",
  [switch]$CreateAzureIdentity,
  [switch]$ApplyGitHub,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Get-RepoFromGit {
  $remote = (git remote get-url origin).Trim()
  if ($remote -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(\.git)?$") {
    return "$($Matches.owner)/$($Matches.repo)"
  }

  throw "Unable to infer GitHub repository from origin remote: $remote"
}

function Resolve-GhPath {
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

  throw "Required command not found: gh. Install GitHub CLI or run without -ApplyGitHub and copy values manually."
}

function Invoke-Az {
  param([string[]]$Arguments)

  $output = & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "az $($Arguments -join ' ') failed"
  }
  return $output
}

function Invoke-Gh {
  param([string[]]$Arguments)

  if ($DryRun) {
    Write-Host "[dry-run] gh $($Arguments -join ' ')"
    return
  }

  & $script:GhExecutable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "gh $($Arguments -join ' ') failed"
  }
}

function Set-GhSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing value for secret $Name"
  }

  if ($DryRun) {
    Write-Host "[dry-run] secret $Name"
    return
  }

  $Value | & $script:GhExecutable secret set $Name --repo $Repo | Out-Null
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

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing value for variable $Name"
  }

  Invoke-Gh @("variable", "set", $Name, "--repo", $Repo, "--body", $Value)
  Write-Host "Set variable $Name=$Value"
}

Assert-Command git
Assert-Command az
Assert-Command terraform

if ([string]::IsNullOrWhiteSpace($Repo)) {
  $Repo = Get-RepoFromGit
}

if ([string]::IsNullOrWhiteSpace($GhcrOwner)) {
  $GhcrOwner = $Repo.Split("/")[0]
}

$SubscriptionId = (Invoke-Az @("account", "show", "--query", "id", "-o", "tsv")).Trim()
$TenantId = (Invoke-Az @("account", "show", "--query", "tenantId", "-o", "tsv")).Trim()
$StorageAccountName = (terraform -chdir=terraform/azure-aks output -raw storage_account_name).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "terraform output storage_account_name failed"
}
$StorageAccountKey = (terraform -chdir=terraform/azure-aks output -raw storage_account_primary_access_key).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "terraform output storage_account_primary_access_key failed"
}

$AppId = ""
if ($CreateAzureIdentity) {
  $existingAppIdOutput = az ad app list --display-name $AppDisplayName --query "[0].appId" -o tsv
  if ($LASTEXITCODE -ne 0) {
    throw "az ad app list failed"
  }
  $existingAppId = if ($null -eq $existingAppIdOutput) { "" } else { $existingAppIdOutput.Trim() }

  if ([string]::IsNullOrWhiteSpace($existingAppId)) {
    if ($DryRun) {
      Write-Host "[dry-run] create Azure app registration $AppDisplayName"
      $AppId = "<created-app-id>"
    } else {
      $AppId = (Invoke-Az @("ad", "app", "create", "--display-name", $AppDisplayName, "--query", "appId", "-o", "tsv")).Trim()
      Invoke-Az @("ad", "sp", "create", "--id", $AppId) | Out-Null
    }
  } else {
    $AppId = $existingAppId
    Write-Host "Using existing Azure app registration: $AppDisplayName ($AppId)"
  }

  if (-not $DryRun) {
    $RgScope = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup"
    $AksId = (Invoke-Az @("aks", "show", "-g", $ResourceGroup, "-n", $AksCluster, "--query", "id", "-o", "tsv")).Trim()

    az role assignment create --assignee $AppId --role "Contributor" --scope $RgScope 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Contributor role assignment may already exist or may need portal permission review."
    }
    az role assignment create --assignee $AppId --role "Azure Kubernetes Service Cluster Admin Role" --scope $AksId 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "AKS Cluster Admin role assignment may already exist or may need portal permission review."
    }

    $subject = "repo:${Repo}:environment:staging"
    Write-Host "Required federated credential subject: $subject"
    $existingFicOutput = az ad app federated-credential list --id $AppId --query "[?name=='github-staging'] | [0]" -o json
    if ($LASTEXITCODE -ne 0) {
      throw "az ad app federated-credential list failed"
    }
    $existingFic = if ($null -eq $existingFicOutput -or [string]::IsNullOrWhiteSpace($existingFicOutput.Trim()) -or $existingFicOutput.Trim() -eq "null") {
      $null
    } else {
      $existingFicOutput | ConvertFrom-Json
    }

    if ($null -ne $existingFic -and $existingFic.subject -ne $subject) {
      Write-Host "Federated credential github-staging exists, but subject is different:"
      Write-Host "  current:  $($existingFic.subject)"
      Write-Host "  required: $subject"
      Write-Host "Recreating github-staging federated credential for the current repository."
      Invoke-Az @("ad", "app", "federated-credential", "delete", "--id", $AppId, "--federated-credential-id", "github-staging") | Out-Null
      $existingFic = $null
    }

    if ($null -eq $existingFic) {
      $ficPath = Join-Path $env:TEMP "lttl-github-staging-fic.json"
      @{
        name      = "github-staging"
        issuer    = "https://token.actions.githubusercontent.com"
        subject   = $subject
        audiences = @("api://AzureADTokenExchange")
      } | ConvertTo-Json | Set-Content -LiteralPath $ficPath -Encoding UTF8

      Invoke-Az @("ad", "app", "federated-credential", "create", "--id", $AppId, "--parameters", $ficPath) | Out-Null
    } else {
      Write-Host "Federated credential github-staging already exists with the correct subject."
    }
  }
} else {
  $existingAppIdOutput = az ad app list --display-name $AppDisplayName --query "[0].appId" -o tsv
  if ($LASTEXITCODE -ne 0) {
    throw "az ad app list failed"
  }
  $AppId = if ($null -eq $existingAppIdOutput) { "" } else { $existingAppIdOutput.Trim() }
  if ([string]::IsNullOrWhiteSpace($AppId)) {
    Write-Host "Azure app registration was not found. Re-run with -CreateAzureIdentity to create it."
    $AppId = "<azure-client-id>"
  }
}

$SecretValues = [ordered]@{
  AZURE_CLIENT_ID                  = $AppId
  AZURE_TENANT_ID                  = $TenantId
  AZURE_SUBSCRIPTION_ID            = $SubscriptionId
  GHCR_PULL_USERNAME               = $GhcrPullUsername
  GHCR_PULL_TOKEN                  = $GhcrPullToken
  STAGING_POSTGRES_PASSWORD        = $PostgresPassword
  STAGING_RABBITMQ_PASSWORD        = $RabbitmqPassword
  STAGING_RABBITMQ_ERLANG_COOKIE   = $RabbitmqErlangCookie
  STAGING_KEYCLOAK_ADMIN_PASSWORD  = $KeycloakAdminPassword
  STAGING_KEYCLOAK_CLIENT_SECRET   = $KeycloakClientSecret
  STAGING_STORAGE_ACCOUNT_NAME     = $StorageAccountName
  STAGING_STORAGE_ACCOUNT_KEY      = $StorageAccountKey
}

$VariableValues = [ordered]@{
  AZURE_AKS_RESOURCE_GROUP = $ResourceGroup
  AZURE_AKS_CLUSTER_NAME   = $AksCluster
  GHCR_OWNER               = $GhcrOwner
  STAGING_API_HOST         = $ApiHost
  STAGING_AUTH_HOST        = $AuthHost
  STAGING_FRONTEND_ORIGIN  = $FrontendOrigin
  STAGING_API_SCHEME       = $ApiScheme
  STAGING_SEED_ENABLED     = $StagingSeedEnabled
  STAGING_AUTO_DEPLOY_ENABLED = "true"
}

Write-Host ""
Write-Host "GitHub repository: $Repo"
Write-Host "Azure client id: $AppId"
Write-Host "Azure tenant id: $TenantId"
Write-Host "Azure subscription id: $SubscriptionId"
Write-Host ""

if ($ApplyGitHub) {
  $script:GhExecutable = Resolve-GhPath

  foreach ($entry in $VariableValues.GetEnumerator()) {
    Set-GhVariable -Name $entry.Key -Value ([string]$entry.Value)
  }

  foreach ($entry in $SecretValues.GetEnumerator()) {
    Set-GhSecret -Name $entry.Key -Value ([string]$entry.Value)
  }
} else {
  Write-Host "Create these GitHub Variables:"
  foreach ($entry in $VariableValues.GetEnumerator()) {
    Write-Host "  $($entry.Key)=$($entry.Value)"
  }

  Write-Host ""
  Write-Host "Create these GitHub Secrets:"
  foreach ($entry in $SecretValues.GetEnumerator()) {
    if ($entry.Key -match "KEY|TOKEN|PASSWORD|SECRET|COOKIE") {
      Write-Host "  $($entry.Key)=<hidden>"
    } else {
      Write-Host "  $($entry.Key)=$($entry.Value)"
    }
  }
}
