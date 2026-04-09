$models = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

$baseUri = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$destDir = "public/models"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir
}

foreach ($model in $models) {
    $url = "$baseUri/$model"
    $dest = Join-Path $destDir $model
    
    Write-Host "Downloading $model..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -ErrorAction Stop
    } catch {
        Write-Warning "Failed to download $model from $url. Error: $_"
    }
}

Write-Host "✅ Model download attempt finished. Verify public/models context."
