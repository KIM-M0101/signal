$ErrorActionPreference = 'Stop'
$root = Join-Path (Split-Path -Parent $PSScriptRoot) '.local-ai'
New-Item -ItemType Directory -Path $root -Force | Out-Null

function Get-VerifiedFile($url, $name, $sha256) {
    $destination = Join-Path $root $name
    if ((Test-Path -LiteralPath $destination) -and (Get-FileHash -LiteralPath $destination).Hash -eq $sha256) {
        return $destination
    }
    $partial = "$destination.part"
    Write-Host "Downloading $name"
    & curl.exe --fail --location --retry 2 --connect-timeout 20 --speed-time 90 --speed-limit 1024 --continue-at - --silent --show-error --output $partial $url
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $name" }
    if ((Get-FileHash -LiteralPath $partial).Hash -ne $sha256) { throw "SHA-256 mismatch: $name" }
    Move-Item -LiteralPath $partial -Destination $destination -Force
    return $destination
}

$archive = Get-VerifiedFile `
    'https://github.com/ggml-org/llama.cpp/releases/download/b12244/llama-b12244-bin-win-cpu-x64.zip' `
    'llama-b12244-bin-win-cpu-x64.zip' '318f11fadcbc3a86541ec55d9930cc76646c6b8d2ff18798c8477e9ff0dc452a'
$bin = Join-Path $root 'llama-b12244'
Expand-Archive -LiteralPath $archive -DestinationPath $bin -Force
$model = Get-VerifiedFile `
    'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true' `
    'qwen2.5-1.5b-instruct-q4_k_m.gguf' '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e'
Write-Host "Verified local AI runtime and model: $model"
