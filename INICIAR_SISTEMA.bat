@echo off
TITLE Sistema de Planejamento Estratégico - Servidor
echo [1/2] Verificando Node.js...

set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js não encontrado. Por favor, verifique se instalou corretamente.
    pause
    exit
)

echo [2/2] Iniciando Servidor Backend...
cd server
start /B node server.js

echo.
echo ==========================================
echo   SISTEMA INICIALIZADO COM SUCESSO!
echo ==========================================
echo.
echo O servidor está rodando em http://localhost:3000
echo Abrindo o aplicativo no navegador...
echo.
echo [NÃO FECHE ESTA JANELA ENQUANTO ESTIVER USANDO O SISTEMA]
echo.

cd ..
start index.html

pause
