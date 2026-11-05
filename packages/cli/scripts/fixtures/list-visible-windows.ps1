# Prints the title of every visible top-level window, one per line.
#
# Enumerates all windows instead of relying on Get-Process MainWindowHandle,
# which only reflects a process's "main window" and misses visible windows on
# the windows-2025-vs2026 hosted image (November 2026 release gates, three
# consecutive timeouts with Linux and macOS passing on the same commits).

Add-Type -Namespace OmniCraft -Name Win32 -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int maxCount);
'@

$titles = New-Object System.Collections.Generic.List[string]
$callback = [OmniCraft.Win32+EnumWindowsProc]{
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  if ([OmniCraft.Win32]::IsWindowVisible($hWnd)) {
    $builder = New-Object System.Text.StringBuilder 512
    [OmniCraft.Win32]::GetWindowText($hWnd, $builder, 512) | Out-Null
    if ($builder.Length -gt 0) { $titles.Add($builder.ToString()) }
  }
  return $true
}
[OmniCraft.Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
foreach ($title in $titles) { $title }
