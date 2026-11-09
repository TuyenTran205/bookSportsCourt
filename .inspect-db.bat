@echo off
set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
set "PGPASSWORD=MyPostGreSQl123"
set "PGHOST=127.0.0.1"
set "PGPORT=5432"
set "PGUSER=postgres"
set "DB=booksportscourt"

echo === BANG ===
"%PGBIN%\psql.exe" -d %DB% -w -tAc "select string_agg(table_name, ', ' order by table_name) from information_schema.tables where table_schema='public'"

echo === MIGRATION DA AP DUNG ===
"%PGBIN%\psql.exe" -d %DB% -w -tAc "select count(*) from information_schema.tables where table_schema='drizzle'" > "%TEMP%\m.txt" 2>&1
type "%TEMP%\m.txt"
"%PGBIN%\psql.exe" -d %DB% -w -c "select * from drizzle.__drizzle_migrations order by id" 2>&1 | findstr /v "^$"

echo === SO DONG DU LIEU ===
"%PGBIN%\psql.exe" -d %DB% -w -tAc "select 'users=' || (select count(*) from users) || ' venues=' || (select count(*) from venues) || ' courts=' || (select count(*) from courts) || ' sports=' || (select count(*) from sports) || ' areas=' || (select count(*) from areas) || ' bookings=' || (select count(*) from bookings) || ' opening_hours=' || (select count(*) from opening_hours) || ' pricing_rules=' || (select count(*) from pricing_rules)" 2>&1
goto :eof