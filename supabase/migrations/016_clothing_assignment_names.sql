alter table public.clothing_assignments
  add column if not exists employee_name text not null default '';

update public.clothing_assignments as assignment
set employee_name = trim(concat(employee.first_name, ' ', employee.last_name))
from public.employees as employee
where assignment.employee_id = employee.id
  and assignment.employee_name = '';

notify pgrst, 'reload schema';