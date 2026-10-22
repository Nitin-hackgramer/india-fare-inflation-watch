-- Run only if you already ran an older schema.sql. Fresh installs: schema.sql already includes this.
alter table routes alter column distance_km drop not null;
alter table data_sources drop constraint if exists data_sources_type_check;
alter table data_sources add constraint data_sources_type_check check (type in ('airline', 'ota', 'gds', 'feed'));
insert into data_sources values
  ('src-amadeus','Amadeus Flight Offers (Enterprise API)','gds',true),
  ('src-feed','Permitted partner feed (CSV)','feed',true)
on conflict do nothing;
