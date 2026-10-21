param(
  [Parameter(Mandatory = $true)][int]$RootPid,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [int]$Samples = 30,
  [int]$IntervalMs = 500
)

$rows = [System.Collections.Generic.List[object]]::new()
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

for ($sample = 0; $sample -lt $Samples; $sample += 1) {
  $allProcesses = @(Get-CimInstance Win32_Process)
  $byPid = @{}
  foreach ($item in $allProcesses) {
    $byPid[[int]$item.ProcessId] = $item
  }

  $processIds = [System.Collections.Generic.HashSet[int]]::new()
  [void]$processIds.Add($RootPid)
  do {
    $addedProcess = $false
    foreach ($item in $allProcesses) {
      if ($processIds.Contains([int]$item.ParentProcessId)) {
        $addedProcess = $processIds.Add([int]$item.ProcessId) -or $addedProcess
      }
    }
  } while ($addedProcess)

  $processSnapshot = @(
    foreach ($processId in $processIds) {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($process) {
        $item = $byPid[$processId]
        $role = if ($item.Name -eq 'fileterm.exe') { 'fileterm' } elseif ($item.CommandLine -match '--type=([^ ]+)') { $Matches[1] } else { 'browser' }
        [pscustomobject]@{
          pid = $processId
          role = $role
          workingSetBytes = [long]$process.WorkingSet64
          privateBytes = [long]$process.PrivateMemorySize64
          cpuMs = [math]::Round($process.TotalProcessorTime.TotalMilliseconds, 1)
        }
      }
    }
  )

  $rows.Add([pscustomobject]@{
    capturedAt = (Get-Date).ToString('o')
    elapsedMs = [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 1)
    processCount = $processSnapshot.Count
    treeWorkingSetBytes = [long](($processSnapshot | Measure-Object workingSetBytes -Sum).Sum)
    treePrivateBytes = [long](($processSnapshot | Measure-Object privateBytes -Sum).Sum)
    treeCpuMs = [math]::Round(($processSnapshot | Measure-Object cpuMs -Sum).Sum, 1)
    processes = $processSnapshot
  })

  if ($sample + 1 -lt $Samples) {
    Start-Sleep -Milliseconds $IntervalMs
  }
}

$stopwatch.Stop()
$first = $rows[0]
$last = $rows[$rows.Count - 1]
$summary = [pscustomobject]@{
  rootPid = $RootPid
  sampleCount = $rows.Count
  requestedSleepMs = $IntervalMs
  durationMs = $last.elapsedMs
  meanActualIntervalMs = if ($rows.Count -gt 1) { [math]::Round($last.elapsedMs / ($rows.Count - 1), 1) } else { 0 }
  peakTreeWorkingSetBytes = [long](($rows | Measure-Object treeWorkingSetBytes -Maximum).Maximum)
  peakTreePrivateBytes = [long](($rows | Measure-Object treePrivateBytes -Maximum).Maximum)
  treeCpuDeltaMs = [math]::Round($last.treeCpuMs - $first.treeCpuMs, 1)
}

[pscustomobject]@{ summary = $summary; samples = $rows } |
  ConvertTo-Json -Depth 6 |
  Set-Content -LiteralPath $OutputPath -Encoding utf8

$summary | Format-List
