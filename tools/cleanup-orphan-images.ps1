param([switch]$Execute)
$ErrorActionPreference = 'Stop'
$cleanupScript = Join-Path $PSScriptRoot 'cleanup-orphan-images.cjs'
$cleanupPreviousKey = $env:SUPABASE_SERVICE_ROLE_KEY
$cleanupSecureKey = $null
$cleanupKeyPointer = [IntPtr]::Zero
try {
    if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
        $cleanupSecureKey = Read-Host 'Clave administrativa existente de fuckface (entrada oculta)' -AsSecureString
        $cleanupKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cleanupSecureKey)
        $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cleanupKeyPointer)
    }
    Write-Host 'Evitá cargas o ediciones del inventario mientras ejecutás esta limpieza.'
    & node $cleanupScript
    if ($LASTEXITCODE -ne 0) { throw 'La revisión falló. No se inició el borrado.' }
    if ($Execute) {
        $cleanupConfirmation = Read-Host 'Escribí ELIMINAR para borrar permanentemente las fotos revisadas'
        if ($cleanupConfirmation -cne 'ELIMINAR') { Write-Host 'Cancelado. No se borró nada.'; return }
        & node $cleanupScript --execute
        if ($LASTEXITCODE -ne 0) { throw 'La limpieza se detuvo. Revisá el inventario y Storage antes de reintentar.' }
    } else {
        Write-Host 'Solo revisión. Para revisar y borrar ejecutá el mismo script con -Execute.'
    }
} finally {
    $env:SUPABASE_SERVICE_ROLE_KEY = $cleanupPreviousKey
    if ($cleanupKeyPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cleanupKeyPointer) }
    if ($cleanupSecureKey) { $cleanupSecureKey.Dispose() }
}
