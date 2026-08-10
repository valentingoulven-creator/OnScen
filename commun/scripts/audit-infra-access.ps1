$keys = @(
  'JWT_SECRET','ENCRYPTION_KEY','DATABASE_URL','PG_SSL','PG_POOL_MAX',
  'SIGHTENGINE_API_USER','SIGHTENGINE_API_SECRET','SIGHTENGINE_ENABLED',
  'LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET',
  'CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_STREAM_API_TOKEN','CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN',
  'STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET',
  'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET',
  'YOUTUBE_API_KEY','FACEBOOK_APP_ID','FACEBOOK_APP_SECRET',
  'VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','PROD_ADMIN_EMAIL','PROD_ADMIN_PASSWORD',
  'SCW_BUCKET','SCW_ACCESS_KEY','SCW_SECRET_KEY'
)
foreach ($f in @('c:\Dev\OnScen\msdev\.env','c:\Dev\OnScen\backend\.env.production')) {
  Write-Output "--- $(Split-Path $f -Leaf) ---"
  if (-not (Test-Path $f)) { Write-Output 'MISSING FILE'; continue }
  foreach ($k in $keys) {
    $l = Select-String -Path $f -Pattern "^$k=" | Select-Object -First 1
    if ($l -and ($l.Line -split '=',2)[1].Trim().Length -gt 3) { Write-Output "SET $k" }
    else { Write-Output "MISS $k" }
  }
}
