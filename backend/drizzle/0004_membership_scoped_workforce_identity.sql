-- REQ-21: additive workforce identity for the active development schema.
-- Legacy user_id remains intact for compatibility.
alter table public.shift_sessions
  add column if not exists membership_id integer
  references public.tenant_memberships(id) on delete set null;

create index if not exists idx_shift_sessions_membership_opened_at
  on public.shift_sessions(membership_id, opened_at);

-- `shift_sessions` has tenant_id, so historical rows are mapped only when that
-- exact Account/Tenant pair identifies one membership. Unknown/ambiguous rows
-- intentionally remain NULL.
with candidates as (
  select
    ss.id,
    array_agg(tm.id order by tm.id) as membership_ids
  from public.shift_sessions ss
  join public.tenant_memberships tm
    on tm.user_id = ss.user_id
   and tm.tenant_id = ss.tenant_id
  group by ss.id
)
update public.shift_sessions ss
   set membership_id = candidates.membership_ids[1]
  from candidates
 where ss.id = candidates.id
   and ss.membership_id is null
   and cardinality(candidates.membership_ids) = 1;

-- Compatibility writer for current legacy-shaped shift writes. It never guesses
-- a membership: the membership is assigned only for one exact User/Tenant match.
create function public.assign_shift_session_membership_id()
returns trigger
language plpgsql
security invoker
as $$
declare
  candidate_membership_ids integer[];
begin
  if new.membership_id is null
     and new.user_id is not null
     and new.tenant_id is not null then
    select array_agg(tm.id order by tm.id)
      into candidate_membership_ids
      from public.tenant_memberships tm
     where tm.user_id = new.user_id
       and tm.tenant_id = new.tenant_id;

    if cardinality(candidate_membership_ids) = 1 then
      new.membership_id := candidate_membership_ids[1];
    end if;
  end if;

  return new;
end;
$$;

create trigger shift_session_membership_identity
before insert or update of user_id, tenant_id, membership_id
on public.shift_sessions
for each row
execute function public.assign_shift_session_membership_id();
