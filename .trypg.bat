@echo off
set "PSQL=C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "%APPDATA%\postgresql\pgpass.conf" echo CO_PGPASS_CONF
for %%p in (postgres admin 123456 root password postgres123 1234 sa abc123 1 12345678 quantri) do (
  set "PGPASSWORD=%%p"
  "%PSQL%" -h 127.0.0.1 -p 5432 -U postgres -d postgres -w -tAc "select 1" >"%TEMP%\pgout.txt" 2>&1
  if not errorlevel 1 (
    echo FOUND_PASSWORD=%%p
    goto :eof
  )
)
echo NO_PASSWORD_FOUND
type "%TEMP%\pgout.txt"