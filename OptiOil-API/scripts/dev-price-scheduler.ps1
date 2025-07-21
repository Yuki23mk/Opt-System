# ==================================================
# 開発環境（Windows）用 価格スケジュールテスト実行（改良版）
# OptiOil-API/scripts/dev-price-scheduler.ps1
# ==================================================

param(
    [string]$Environment = $null,
    [string]$ApiUrl = $null,
    [switch]$TestRun,
    [switch]$LoadEnv,
    [switch]$SetupOnly
)

# 環境変数読み込み関数
function Load-DotEnv {
    param([string]$Path)
    
    if (Test-Path $Path) {
        Write-Host "環境変数ファイルを読み込み中: $Path" -ForegroundColor Cyan
        
        Get-Content $Path | ForEach-Object {
            if ($_ -match '^([^#\s][^=]*?)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                
                # 既存の環境変数展開
                $value = [System.Environment]::ExpandEnvironmentVariables($value)
                
                # 環境変数設定
                [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
                Write-Host "  設定: $name = $value" -ForegroundColor Gray
            }
        }
        Write-Host "環境変数の読み込み完了" -ForegroundColor Green
    } else {
        Write-Host "環境変数ファイルが見つかりません: $Path" -ForegroundColor Yellow
        Write-Host "デフォルト設定を使用します" -ForegroundColor Yellow
    }
}

# プロジェクトルート検出
$projectRoot = $PWD.Path
if (!(Test-Path (Join-Path $projectRoot ".env"))) {
    # .envが見つからない場合、一つ上の階層を確認
    $parentPath = Split-Path $projectRoot -Parent
    if (Test-Path (Join-Path $parentPath ".env")) {
        $projectRoot = $parentPath
    } else {
        # 環境変数から取得、またはデフォルト
        $projectRoot = if ($env:OPT_PROJECT_ROOT) { 
            [System.Environment]::ExpandEnvironmentVariables($env:OPT_PROJECT_ROOT)
        } else { 
            "$env:USERPROFILE\OptiOil-API" 
        }
    }
}

# 環境変数読み込み
$envFile = Join-Path $projectRoot ".env"
if ($LoadEnv -or !(Test-Path env:OPT_SCRIPTS_DIR)) {
    Load-DotEnv -Path $envFile
}

# 設定取得（優先順位: パラメータ > 環境変数 > デフォルト）
$Environment = if ($Environment) { $Environment } elseif ($env:OPT_ENVIRONMENT) { $env:OPT_ENVIRONMENT } else { "development" }
$ApiUrl = if ($ApiUrl) { $ApiUrl } elseif ($env:OPT_API_URL) { $env:OPT_API_URL } elseif ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL } else { "http://localhost:3001" }

$scriptsDir = if ($env:OPT_SCRIPTS_DIR) { $env:OPT_SCRIPTS_DIR } else { "scripts" }
$logsDir = if ($env:OPT_LOGS_DIR) { $env:OPT_LOGS_DIR } else { "logs" }
$logLevel = if ($env:OPT_LOG_LEVEL) { $env:OPT_LOG_LEVEL } else { "INFO" }
$authToken = if ($env:OPT_SCHEDULER_TOKEN) { $env:OPT_SCHEDULER_TOKEN } else { "dummy-token" }
$taskPrefix = if ($env:OPT_TASK_NAME_PREFIX) { $env:OPT_TASK_NAME_PREFIX } else { "Opt-PriceScheduler" }

# パス構築
$logDir = Join-Path $projectRoot $logsDir
$logFile = Join-Path $logDir "price-scheduler-dev.log"
$apiEndpoint = "$ApiUrl/api/admin/batch/price-schedules"

# ログディレクトリ作成
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir
    Write-Host "ログディレクトリを作成しました: $logDir" -ForegroundColor Green
}

# ヘッダー設定
$headers = @{
    "Authorization" = "Bearer $authToken"
    "Content-Type" = "application/json"
}
$body = '{"action":"apply_schedules"}'

# ログ関数（レベル対応）
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    # ログレベルフィルタリング
    $levelOrder = @{ "DEBUG" = 0; "INFO" = 1; "WARNING" = 2; "ERROR" = 3 }
    $currentLevelNum = $levelOrder[$logLevel]
    $messageLevelNum = $levelOrder[$Level]
    
    if ($messageLevelNum -ge $currentLevelNum) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $logMessage = "[$timestamp] [$Level] $Message"
        Add-Content -Path $logFile -Value $logMessage
        
        switch ($Level) {
            "ERROR" { Write-Host $logMessage -ForegroundColor Red }
            "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
            "INFO" { Write-Host $logMessage -ForegroundColor White }
            "DEBUG" { Write-Host $logMessage -ForegroundColor Gray }
            default { Write-Host $logMessage -ForegroundColor White }
        }
    }
}

# 設定情報表示
function Show-Configuration {
    Write-Host "=== 価格スケジューラ設定 ===" -ForegroundColor Cyan
    Write-Host "プロジェクトルート: $projectRoot" -ForegroundColor Gray
    Write-Host "環境: $Environment" -ForegroundColor Gray  
    Write-Host "API URL: $ApiUrl" -ForegroundColor Gray
    Write-Host "ログディレクトリ: $logDir" -ForegroundColor Gray
    Write-Host "ログレベル: $logLevel" -ForegroundColor Gray
    Write-Host "認証トークン: Bearer $($authToken.Substring(0, [Math]::Min(10, $authToken.Length)))..." -ForegroundColor Gray
    Write-Host "タスク名プレフィックス: $taskPrefix" -ForegroundColor Gray
    Write-Host "=========================" -ForegroundColor Cyan
}

# タスクスケジューラ設定関数
function Register-PriceSchedulerTask {
    param(
        [string]$TaskType = "daily",  # "test", "daily", "hourly"
        [switch]$Force
    )
    
    $testInterval = if ($env:OPT_SCHEDULE_DEV) { [int]$env:OPT_SCHEDULE_DEV } else { 5 }
    $scriptPath = Join-Path $projectRoot $scriptsDir "dev-price-scheduler.ps1"
    
    # タスク名とトリガー設定
    switch ($TaskType) {
        "test" {
            $taskName = "$taskPrefix-Test"
            $description = "Opt. 価格スケジュール（開発テスト用・${testInterval}分おき）"
            $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $testInterval) -RepetitionDuration (New-TimeSpan -Hours 8)
        }
        "daily" {
            $taskName = "$taskPrefix-Daily"
            $description = "Opt. 価格スケジュール（毎日00:00実行）"
            $trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
        }
        "hourly" {
            $taskName = "$taskPrefix-Hourly"
            $description = "Opt. 価格スケジュール（毎時実行）"
            $trigger = New-ScheduledTaskTrigger -Once -At "00:00" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 365)
        }
    }
    
    # 既存タスク確認・削除
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        if ($Force) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "既存タスクを削除しました: $taskName" -ForegroundColor Yellow
        } else {
            Write-Host "タスクが既に存在します: $taskName (上書きする場合は -Force オプションを使用)" -ForegroundColor Warning
            return $taskName
        }
    }
    
    # タスク作成
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -LoadEnv"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description $description -User $env:USERNAME
    
    Write-Host "タスクスケジューラを設定しました: $taskName" -ForegroundColor Green
    Write-Host "次回実行予定: $((Get-ScheduledTask -TaskName $taskName).Triggers[0].StartBoundary)" -ForegroundColor Cyan
    
    return $taskName
}

# セットアップ関数
function Setup-PriceScheduler {
    param([switch]$TestMode, [switch]$ProductionMode)
    
    Write-Host "=== Opt. 価格スケジューラ セットアップ ===" -ForegroundColor Cyan
    Show-Configuration
    
    if ($TestMode) {
        Write-Host "テストモードでセットアップします..." -ForegroundColor Yellow
        $taskName = Register-PriceSchedulerTask -TaskType "test" -Force
        
        # 即座にテスト実行
        Write-Host "テスト実行中..." -ForegroundColor Yellow
        Start-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 3
        
        # ログ確認
        if (Test-Path $logFile) {
            Write-Host "=== 最新のログ ===" -ForegroundColor Cyan
            Get-Content $logFile -Tail 5
        }
    }
    
    if ($ProductionMode) {
        Write-Host "本番モードでセットアップします..." -ForegroundColor Green
        Register-PriceSchedulerTask -TaskType "daily" -Force
    }
    
    # 設定確認
    Write-Host "=== 登録済みタスク一覧 ===" -ForegroundColor Cyan
    $tasks = Get-ScheduledTask -TaskName "*$taskPrefix*" -ErrorAction SilentlyContinue
    if ($tasks) {
        $tasks | Format-Table TaskName, State, LastRunTime, NextRunTime
    } else {
        Write-Host "登録済みタスクが見つかりません" -ForegroundColor Yellow
    }
    
    Write-Host "セットアップ完了！" -ForegroundColor Green
}

# ステータス表示関数
function Show-PriceSchedulerStatus {
    Write-Host "=== 価格スケジューラ ステータス ===" -ForegroundColor Cyan
    Show-Configuration
    
    # タスク一覧
    $tasks = Get-ScheduledTask -TaskName "*$taskPrefix*" -ErrorAction SilentlyContinue
    if ($tasks) {
        Write-Host "=== 登録済みタスク ===" -ForegroundColor Cyan
        $tasks | Format-Table TaskName, State, LastRunTime, NextRunTime
    } else {
        Write-Host "登録済みタスクが見つかりません" -ForegroundColor Yellow
    }
    
    # ログファイル確認
    if (Test-Path $logFile) {
        $logSize = (Get-Item $logFile).Length
        Write-Host "ログファイル: $logFile (サイズ: $([math]::Round($logSize/1024, 2)) KB)" -ForegroundColor Gray
        
        Write-Host "=== 最新ログ (5行) ===" -ForegroundColor Cyan
        Get-Content $logFile -Tail 5
    } else {
        Write-Host "ログファイルが見つかりません: $logFile" -ForegroundColor Yellow
    }
}

# セットアップのみの場合
if ($SetupOnly) {
    Show-Configuration
    Write-Host ""
    Write-Host "=== 使用可能なコマンド ===" -ForegroundColor Cyan
    Write-Host "Setup-PriceScheduler -TestMode        # テストモード設定" -ForegroundColor Gray
    Write-Host "Setup-PriceScheduler -ProductionMode  # 本番モード設定" -ForegroundColor Gray
    Write-Host "Show-PriceSchedulerStatus             # ステータス確認" -ForegroundColor Gray
    return
}

# メイン処理
try {
    Write-Log "=== 価格スケジュール実行開始 ===" "INFO"
    Write-Log "Environment: $Environment" "INFO"
    Write-Log "API URL: $apiEndpoint" "INFO"
    
    if ($TestRun) {
        Write-Log "テストモード: 実際のAPIは呼び出しません" "WARNING"
        Write-Log "本来であれば以下のAPIを呼び出します:" "INFO"
        Write-Log "POST $apiEndpoint" "INFO"
        Write-Log "Body: $body" "INFO"
        return
    }
    
    # API実行前チェック
    Write-Log "APIサーバーの接続確認..." "INFO"
    try {
        $healthCheck = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
        Write-Log "APIサーバー接続OK" "INFO"
    } catch {
        Write-Log "APIサーバーに接続できません。OptiOil-APIが起動しているか確認してください。" "ERROR"
        Write-Log "エラー詳細: $($_.Exception.Message)" "ERROR"
        return
    }
    
    # 価格スケジュール実行
    Write-Log "価格スケジュール適用処理を実行..." "INFO"
    $response = Invoke-RestMethod -Uri $apiEndpoint -Method POST -Headers $headers -Body $body -TimeoutSec 30
    
    # 結果処理
    if ($response.success) {
        Write-Log "価格スケジュール適用完了: $($response.appliedCount)件" "INFO"
        
        if ($response.appliedCount -gt 0 -and $response.details) {
            Write-Log "適用詳細:" "INFO"
            foreach ($detail in $response.details) {
                if ($detail.success) {
                    $detailMessage = "  ✓ $($detail.companyName): $($detail.productName) -> ¥$($detail.newPrice)"
                    Write-Log $detailMessage "INFO"
                } else {
                    $detailMessage = "  ✗ Schedule ID $($detail.scheduleId): $($detail.error)"
                    Write-Log $detailMessage "ERROR"
                }
            }
        } elseif ($response.appliedCount -eq 0) {
            Write-Log "適用対象のスケジュールはありませんでした" "INFO"
        }
        
        if ($response.failedCount -gt 0) {
            Write-Log "失敗件数: $($response.failedCount)件" "WARNING"
        }
    } else {
        Write-Log "価格スケジュール適用に失敗しました" "ERROR"
        Write-Log "レスポンス: $($response | ConvertTo-Json -Depth 3)" "ERROR"
    }
    
} catch {
    Write-Log "実行中にエラーが発生しました: $($_.Exception.Message)" "ERROR"
    
    # HTTPエラーの詳細表示
    if ($_.Exception -is [System.Net.WebException]) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseContent = $reader.ReadToEnd()
        Write-Log "HTTPエラー詳細: $responseContent" "ERROR"
    }
    
    exit 1
} finally {
    Write-Log "=== 価格スケジュール実行終了 ===" "INFO"
}

# スクリプトが直接実行された場合の使用例表示
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name) {
    Write-Host ""
    Write-Host "=== 使用例 ===" -ForegroundColor Cyan
    Write-Host "設定確認:              .\dev-price-scheduler.ps1 -SetupOnly -LoadEnv" -ForegroundColor Gray
    Write-Host "テスト実行:            .\dev-price-scheduler.ps1 -TestRun -LoadEnv" -ForegroundColor Gray
    Write-Host "実際に実行:            .\dev-price-scheduler.ps1 -LoadEnv" -ForegroundColor Gray
    Write-Host "関数読み込み:          . .\dev-price-scheduler.ps1 -LoadEnv" -ForegroundColor Gray
    Write-Host "セットアップ後:        Setup-PriceScheduler -TestMode" -ForegroundColor Gray
    Write-Host "ステータス確認:        Show-PriceSchedulerStatus" -ForegroundColor Gray
}