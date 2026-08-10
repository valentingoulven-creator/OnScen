# commun/deploy/environments.ps1 — Cibles de deploiement OnScen (prod / preprod)
# Usage : . ./commun/deploy/environments.ps1 ; $cfg = Get-OnScenDeployEnvironment preprod

function Get-OnScenDeployEnvironment {
    param(
        [ValidateSet('prod', 'preprod')]
        [string]$Name = 'prod'
    )

    $map = @{
        prod = @{
            Label          = 'production'
            Vps            = 'root@51.159.164.100'
            SshHost        = 'onscen-prod'
            Remote         = '/opt/onscen'
            Health         = 'https://onscen.com/health'
            SiteUrl        = 'https://onscen.com'
            Pm2App         = 'onscen-backend'
            ViteMode       = 'production'
            ViteEnvFile    = 'web/app/.env.production'
            Caddyfile      = 'commun/deploy/Caddyfile'
            EcosystemFile  = 'commun/deploy/ecosystem.config.cjs'
            ScalewayServer = '7276ff33-dbb6-4bc2-969d-a59be566a78a'
            ScalewayZone   = 'fr-par-2'
        }
        preprod = @{
            Label          = 'preproduction'
            Vps            = 'root@51.159.170.181'
            SshHost        = 'onscen-staging'
            Remote         = '/opt/onscen'
            Health         = 'https://staging.onscen.com/health'
            SiteUrl        = 'https://staging.onscen.com'
            Pm2App         = 'onscen-backend-staging'
            ViteMode       = 'preproduction'
            ViteEnvFile    = 'web/app/.env.preproduction'
            Caddyfile      = 'commun/deploy/Caddyfile.staging'
            EcosystemFile  = 'commun/deploy/ecosystem.staging.config.cjs'
            ScalewayServer = '05d0cabc-cd09-4d7a-8341-e4758d0d00c8'
            ScalewayZone   = 'fr-par-2'
        }
    }

    return $map[$Name]
}
