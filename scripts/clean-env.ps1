# PowerShell script to remove quotes from environment variables
if (Test-Path .env.local) {
    # Remove quotes from environment variables
    $content = Get-Content .env.local -Raw
    # Handle complex JSON values and simple quoted values
    $cleanedContent = $content -replace '(?m)^([^=]+)="(.*)"$', '$1=$2'
    Set-Content .env.local $cleanedContent -NoNewline
    Write-Host "✅ Removed quotes from environment variables"
} else {
    Write-Host "❌ .env.local file not found"
}