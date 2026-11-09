@echo off
set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
set "PGPASSWORD=MyPostGreSQl123"
set "PGHOST=127.0.0.1"
set "PGPORT=5432"
set "PGUSER=postgres"
set "DB=booksportscourt"

echo === KIEM TRA DATABASE ===
"%PGBIN%\psql.exe" -d postgres -w -tAc "select datname from pg_database where datname='%DB%'" > "%TEMP%\exists.txt" 2>&1
set /p DBEXISTS=<"%TEMP%\exists.txt"
if "%DBEXISTS%"=="%DB%" (
  echo DA_CO_DATABASE %DB%
) else (
  "%PGBIN%\createdb.exe" %DB%
  if errorlevel 1 (echo TAO_DB_THAT_BAI & goto :eof)
  echo DA_TAO_DATABASE %DB%
)

echo === DANH SACH BANG HIEN CO ===
"%PGBIN%\psql.exe" -d %DB% -w -tAc "select count(*) || ' bang trong schema public' from information_schema.tables where table_schema='public'"
goto :eof