$ErrorActionPreference='Stop'
$cfg=Get-Content .crm-test-access.json.local -Raw | ConvertFrom-Json
$settings=@{}; Get-Content .env.local | ForEach-Object { if($_ -match '^([^#=]+)=(.*)$') { $settings[$Matches[1]]=$Matches[2].Trim().Trim('"').Trim("'") } }
$base=$settings['VITE_SUPABASE_URL']; $apiKey=$settings['VITE_SUPABASE_PUBLISHABLE_KEY']; $checks=[System.Collections.Generic.List[string]]::new()
function Send-Crm($path,$token,$method='GET',$payload=$null,$bare=$false) { $headers=@{}; if(-not $bare) {$headers.apikey=$apiKey}; if($token){$headers.Authorization="Bearer $token"}; $options=@{Uri="$base$path";Method=$method;Headers=$headers;Proxy='http://127.0.0.1:7897';SkipHttpErrorCheck=$true;TimeoutSec=30};if($null -ne $payload){$options.ContentType='application/json';$options.Body=($payload | ConvertTo-Json -Compress)}; $options.HttpVersion="1.1"; $options.DisableKeepAlive=$true; $r=$null; for($attempt=0;$attempt -lt 3;$attempt++){ try{$r=Invoke-WebRequest @options;break}catch{if($attempt -eq 2){throw}} }; $d=$null;try{$d=$r.Content|ConvertFrom-Json}catch{};return @{status=[int]$r.StatusCode;data=$d} }
function Confirm-Crm($name,$condition) {if(-not $condition){throw "Failed: $name"};$checks.Add($name)}
$m=Send-Crm '/auth/v1/token?grant_type=password' $null 'POST' @{email=$cfg.accounts[0].email;password=$cfg.accounts[0].password}
$e=Send-Crm '/auth/v1/token?grant_type=password' $null 'POST' @{email=$cfg.accounts[2].email;password=$cfg.accounts[2].password}
$mt=$m.data.access_token;$et=$e.data.access_token
if(-not $mt -or -not $et){throw 'Sign-in failed'}
try {
$o=(Send-Crm '/rest/v1/objects?select=*' $mt).data[0]
$r=Send-Crm '/rest/v1/rpc/update_object' $mt 'POST' @{p_object_id=$o.id;p_name=$o.name;p_address=$o.address};Confirm-Crm 'Manager object editing succeeds' ($r.status -eq 200 -and $r.data.id -eq $o.id)
$r=Send-Crm '/rest/v1/rpc/delete_object' $et 'POST' @{p_object_id=$o.id};Confirm-Crm 'Executor object deletion denied' ($r.data.code -eq '42501')
$r=Send-Crm ('/rest/v1/objects?id=eq.'+$o.id) $mt 'PATCH' @{name='Forge'};Confirm-Crm 'Manager direct table update denied' ($r.status -ge 400)
$r=Send-Crm '/rest/v1/rpc/create_object' $null 'POST' @{p_name='Forge';p_address='Forge'};Confirm-Crm 'Anonymous RPC denied' ($r.status -ge 400)
$r=Send-Crm '/functions/v1/crm-test-provision' $mt 'POST' @{};Confirm-Crm 'Provisioning endpoint disabled' ($r.status -eq 410)
$r=Send-Crm '/functions/v1/crm-test-provision' $null 'POST' @{} $true;Confirm-Crm 'Provisioning rejects request without credentials' ($r.status -eq 401)
$null=Send-Crm '/auth/v1/user' $et 'PUT' @{data=@{role=$null}}
$report=Get-Content docs/database-verification.json -Raw|ConvertFrom-Json
$report | Add-Member -NotePropertyName supplemental -NotePropertyValue @{verified_at=(Get-Date).ToUniversalTime().ToString('o');passed=$checks.Count;results=@($checks);runtime='PowerShell HTTP via explicit proxy'} -Force
$report|ConvertTo-Json -Depth 10|Set-Content docs/database-verification.json -Encoding utf8
Write-Output ('SUPPLEMENTAL PASS: '+$checks.Count)
} finally { $null=Send-Crm '/auth/v1/logout' $mt 'POST' @{};$null=Send-Crm '/auth/v1/logout' $et 'POST' @{} }

