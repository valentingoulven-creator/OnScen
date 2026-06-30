using System;
using System.Diagnostics;
using System.IO;

namespace MeloSong
{
    internal static class ServerLauncher
    {
        private static int Main()
        {
            var root = Path.GetDirectoryName(typeof(ServerLauncher).Assembly.Location);
            if (string.IsNullOrEmpty(root) || !File.Exists(Path.Combine(root, "package.json")))
            {
                Console.WriteLine("[ERREUR] server.exe doit etre a la racine MeloSong Dev.");
                Console.ReadLine();
                return 1;
            }

            var ps1 = Path.Combine(root, "msdev", "scripts", "restart-server.ps1");
            if (!File.Exists(ps1))
            {
                Console.WriteLine("[ERREUR] Script introuvable : " + ps1);
                Console.ReadLine();
                return 1;
            }

            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\"",
                WorkingDirectory = root,
                UseShellExecute = false,
            };

            using (var p = Process.Start(psi))
            {
                if (p == null)
                {
                    Console.WriteLine("[ERREUR] Impossible de lancer PowerShell.");
                    Console.ReadLine();
                    return 1;
                }
                p.WaitForExit();
                return p.ExitCode;
            }
        }
    }
}
