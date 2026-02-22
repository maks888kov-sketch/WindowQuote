-- Add product_type (window/door/balcony) for profile filtering
alter table profile_catalog add column if not exists product_type text not null default 'window';

create index if not exists idx_profile_catalog_product_type on profile_catalog(product_type);
