# set-resend-key.ps1 — store the Resend API key on the NFFGA Netlify site.
#
# Asks for the key with the input hidden, checks it against Resend, and
# saves it as a Netlify SECRET (write-only: Netlify never shows it again).
# The key is never printed and never written to a file.
#
# Run from any PowerShell window:
#   powershell -ExecutionPolicy Bypass -File C:\Documents\NFFGA\scripts\set-resend-key.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Documents\NFFGA'   # the folder linked to the nffga Netlify site

$secure = Read-Host -AsSecureString 'Paste the Resend API key (typing is hidden), then press Enter'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

if (-not $key.StartsWith('re_')) {
  Write-Host 'That does not look like a Resend key (they start with re_). Nothing was saved.'
  exit 1
}

# Check the key with Resend before saving it.
$ok = $true
try {
  $r = Invoke-RestMethod -Uri 'https://api.resend.com/domains' -Headers @{ Authorization = "Bearer $key" }
  $d = $r.data | Where-Object { $_.name -eq 'emspcr.app' }
  if ($d) { Write-Host "Resend: the key works, and emspcr.app is $($d.status)." }
  else    { Write-Host 'Resend: the key works, but emspcr.app is not in that Resend account.' }
} catch {
  $body = "$($_.ErrorDetails.Message)"
  if ($body -match 'restricted') {
    Write-Host 'Resend: this is a sending-only key (it cannot list domains). That is fine for sending.'
  } elseif ($body -match 'invalid') {
    Write-Host 'Resend says this key is invalid. Nothing was saved.'
    $ok = $false
  } else {
    Write-Host 'Could not reach Resend to check the key. Saving it anyway.'
  }
}

if ($ok) {
  netlify env:set RESEND_API_KEY $key --secret --context production deploy-preview branch-deploy | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host 'Saved RESEND_API_KEY on the NFFGA site as a secret. You can close this tab and tell Claude it is done.' }
  else { Write-Host 'Netlify did not accept it. Check that you are logged in (netlify status) and try again.' }
}
$key = $null
