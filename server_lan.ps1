$port = 8000
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$listener.Start()

Write-Host "Server started on http://0.0.0.0:$port/"

try {
    while ($true) {
        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $stream = $client.GetStream()
            
            # Read just the request line (ignoring headers for simplicity, because we just need GET)
            if ($client.Available -gt 0) {
                $buffer = New-Object byte[] 4096
                $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
                $requestStr = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $bytesRead)
                
                if ($requestStr -match "^GET\s+(?<path>\S+)\s+HTTP") {
                    $path = $matches['path']
                    if ($path -eq "/") { $path = "/index.html" }
                    
                    # strip query string
                    $path = $path.Split('?')[0]
                    
                    $localPath = Join-Path $PWD $path
                    $localPath = $localPath -replace "/", "\"
                    
                    if (Test-Path -Path $localPath -PathType Leaf) {
                        $content = [System.IO.File]::ReadAllBytes($localPath)
                        $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
                        switch ($ext) {
                            ".html" { $contentType = "text/html; charset=utf-8" }
                            ".css"  { $contentType = "text/css; charset=utf-8" }
                            ".js"   { $contentType = "application/javascript; charset=utf-8" }
                            ".png"  { $contentType = "image/png" }
                            ".json" { $contentType = "application/json; charset=utf-8" }
                            ".ico"  { $contentType = "image/x-icon" }
                            default { $contentType = "application/octet-stream" }
                        }
                        
                        $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($content.Length)`r`nConnection: close`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($content, 0, $content.Length)
                    } else {
                        $notFound = "HTTP/1.1 404 Not Found`r`nConnection: close`r`n`r`nNot Found"
                        $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($notFound)
                        $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
                    }
                }
            }
            $client.Close()
        } else {
            Start-Sleep -Milliseconds 10
        }
    }
} finally {
    $listener.Stop()
}
