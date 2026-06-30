# commun/deploy/environments.ps1 — Cibles de deploiement Soundy (prod / preprod)
# Usage : . ./commun/deploy/environments.ps1 ; $cfg = Get-SoundyDeployEnvironment preprod

function Get-SoundyDeployEnvironment {
    param(
        [ValidateSet('prod', 'preprod')]
        [string]$Name = 'prod'
    )

    $map = @{
        prod = @{
            Label          = 'production'
            Vps            = 'root@51.159.164.100'
            SshHost        = 'soundy-prod'
            Remote         = '/opt/soundly'
            Health         = 'https://getsoundy.com/health'
            SiteUrl        = 'https://getsoundy.com'
            Pm2App         = 'melosong-backend'
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
            SshHost        = 'soundy-staging'
            Remote         = '/opt/soundly'
            Health         = 'https://staging.getsoundy.com/health'
            SiteUrl        = 'https://staging.getsoundy.com'
            Pm2App         = 'melosong-backend-staging'
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
