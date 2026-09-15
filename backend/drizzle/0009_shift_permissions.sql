insert into public.permissions (key, name, module) values
  ('shift.operate', 'Operate Shift', 'pos'),
  ('shift.reconcile', 'Reconcile Shift', 'pos')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_id)
select defaults.role::public.membership_role, permissions.id
from (values
  ('owner', 'shift.operate'), ('owner', 'shift.reconcile'),
  ('manager', 'shift.operate'), ('manager', 'shift.reconcile'),
  ('leader', 'shift.operate')
) as defaults(role, permission_key)
join public.permissions on permissions.key = defaults.permission_key
on conflict (role, permission_id) do nothing;
