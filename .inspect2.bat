@echo off
set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
set "PGPASSWORD=MyPostGreSQl123"
set "PGHOST=127.0.0.1"
set "PGPORT=5432"
set "PGUSER=postgres"
set "DB=booksportscourt"

echo === SCHEMA_MIGRATIONS ===
"%PGBIN%\psql.exe" -d %DB% -w -c "select * from schema_migrations order by 1" 2>&1

echo === TAI KHOAN DEMO ===
"%PGBIN%\psql.exe" -d %DB% -w -c "select email, role, status, full_name from users order by role" 2>&1

echo === CO SO / SAN ===
"%PGBIN%\psql.exe" -d %DB% -w -c "select v.name, v.slug, v.status, c.name as court, count(oh.id) as gio_mo_cua from venues v left join courts c on c.venue_id=v.id left join opening_hours oh on oh.court_id=c.id group by v.name, v.slug, v.status, c.name" 2>&1
goto :eof