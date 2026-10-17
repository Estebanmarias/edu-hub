-- Run in the Supabase SQL editor (once).
alter table profiles add column if not exists username text unique;
