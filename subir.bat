@echo off
setlocal enableextensions
REM ============================================================
REM  Audere (aurencare) - dev local no Windows.
REM  Porta do app Next.js (monolito front + API): http://localhost:3000
REM
REM  Pre-requisito: Postgres + Redis ja precisam estar rodando
REM  (este script NAO os sobe - assume que ja estao no Docker/host).
REM
REM  Passos:
REM    1. cria .env.local (a partir de .env.example) se faltar
REM    2. npm install se nao houver node_modules
REM    3. roda migrations + seed (usuario demo)
REM    4. inicia 'npm run dev' numa aba do Windows Terminal
REM       (-w audere reaproveita a janela se ja estiver aberta)
REM
REM  Login demo: ana@aurencare.com / auren123
REM ============================================================

set "RAIZ=%~dp0"
set "RAIZDIR=%RAIZ:~0,-1%"
cd /d "%RAIZ%"

echo ============================================
echo  Audere - subindo ambiente de desenvolvimento
echo ============================================
echo.

REM --- Pre-requisitos ---------------------------------------
where node >nul 2>&1 || (echo ERRO: node nao encontrado no PATH. & exit /b 1)
where npm  >nul 2>&1 || (echo ERRO: npm nao encontrado no PATH.  & exit /b 1)
echo   (assumindo Postgres + Redis ja em execucao - conforme .env.local)
echo.

REM --- .env.local (cria a partir de .env.example se faltar) --
echo [1/4] Verificando .env.local ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root='%RAIZDIR%'; $envFile=Join-Path $root '.env.local'; if(Test-Path $envFile){ Write-Host '  .env.local ja existe' } else { $example=Join-Path $root '.env.example'; if(-not (Test-Path $example)){ Write-Host '  AVISO: .env.example nao encontrado - pulando' } else { Copy-Item $example $envFile; $gen={ -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) }) }; $c=Get-Content $envFile; $c=$c -replace '^NEXTAUTH_SECRET=.*', ('NEXTAUTH_SECRET=' + (& $gen)) -replace '^ENCRYPTION_KEY=.*', ('ENCRYPTION_KEY=' + (& $gen)); Set-Content -Path $envFile -Value $c; Write-Host '  .env.local criado (preencha ANTHROPIC/EVOLUTION/PAGARME/ASSEMBLYAI com chaves reais)' } }"
echo.

REM --- Dependencias ------------------------------------------
echo [2/4] Verificando dependencias...
if not exist "node_modules" (
    echo   instalando dependencias ^(npm install^)...
    call npm install
    if errorlevel 1 (echo ERRO: falha no npm install. & exit /b 1)
) else (
    echo   node_modules ja presente.
)
echo.

REM --- Migrations + seed -------------------------------------
REM Carrega .env.local (base) + .env.development.local (overrides locais) COM
REM precedencia, igual ao 'next dev'. Assim migrate/seed batem no MESMO banco
REM que o app usa (DATABASE_URL do .env.development.local = aurencare_test).
REM 'npm run migrate' sozinho le so .env.local e apontaria pro cluster k8s.
echo [3/4] Rodando migrations...
call npx tsx --env-file=.env.local --env-file-if-exists=.env.development.local src\server\db\migrate.ts
if errorlevel 1 (echo ERRO: falha nas migrations. & exit /b 1)

echo Garantindo usuario demo ^(ana@aurencare.com / auren123^)...
call npx tsx --env-file=.env.local --env-file-if-exists=.env.development.local src\server\db\seed.ts
if errorlevel 1 (echo ERRO: falha no seed. & exit /b 1)
echo.

REM --- Dev server (Next.js :3000) ---------------------------
echo [4/4] Iniciando Next.js em http://localhost:3000
echo   Login demo: ana@aurencare.com / auren123
echo.

where wt >nul 2>&1
if errorlevel 1 (
    REM Sem Windows Terminal: roda no console atual.
    call npm run dev
) else (
    wt -w audere new-tab --title "AUDERE-WEB" -d "%RAIZDIR%" cmd /k "npm run dev"
)

endlocal
