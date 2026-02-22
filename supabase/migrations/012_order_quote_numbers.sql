alter table orders add column if not exists order_number text;
alter table quotes add column if not exists quote_number text;

create sequence if not exists order_number_seq;
create sequence if not exists quote_number_seq;

create or replace function generate_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'ORD-' || lpad(nextval('order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_number_trigger on orders;
create trigger orders_number_trigger
before insert on orders
for each row execute function generate_order_number();

create or replace function generate_quote_number()
returns trigger
language plpgsql
as $$
begin
  if new.quote_number is null or new.quote_number = '' then
    new.quote_number := 'Q-' || lpad(nextval('quote_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_number_trigger on quotes;
create trigger quotes_number_trigger
before insert on quotes
for each row execute function generate_quote_number();
