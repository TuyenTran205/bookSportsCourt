@echo off
set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
set "PGDATA=D:\BTL_Chuyende\pgdata-bsc"
set "PGPORT=5433"
set "PGLOG=%PGDATA%\server.log"

echo [1/4] initdb...
"%PGBIN%\initdb.exe" -D "%PGDATA%" -U postgres --auth=trust --encoding=UTF8 --locale=C
if errorlevel 1 goto :fail
echo INITDB_OK

echo [2/4] cau hinh port %PGPORT%...
>>"%PGDATA%\postgresql.conf" echo port = %PGPORT%
>>"%PGDATA%\postgresql.conf" echo listen_addresses = 'localhost'
echo CONFIG_OK

echo [3/4] khoi dong server...
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -l "%PGLOG%" -w -t 60 start
if errorlevel 1 goto :fail
echo START_OK

echo [4/4] tao database booksports_dev...
"%PGBIN%\createdb.exe" -h 127.0.0.1 -p %PGPORT% -U postgres booksports_dev
if errorlevel 1 goto :fail
echo CREATEDB_OK

"%PGBIN%\psql.exe" -h 127.0.0.1 -p %PGPORT% -U postgres -d booksports_dev -tAc "select 'PING_OK ' || version();"
goto :eof

:fail
echo FAILED errorlevel=%errorlevel%
if exist "%PGLOG%" type "%PGLOG%"