-- CRM: all client writes are restricted to checked RPCs.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create type public.app_role as enum ('manager','executor');
create type public.task_status as enum ('new','in_progress','review','accepted','revision');
create table public.profiles (
 id uuid primary key references auth.users(id),
 full_name text not null check (full_name ~ '[^[:space:]]'),
 role public.app_role not null
);
create table public.objects (
 id uuid primary key default gen_random_uuid(),
 name text not null check (name ~ '[^[:space:]]'),
 address text not null check (address ~ '[^[:space:]]'),
 created_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 title text not null check (title ~ '[^[:space:]]'),
 description text not null default '',
 object_id uuid not null references public.objects(id),
 assignee_id uuid not null references public.profiles(id),
 status public.task_status not null default 'new',
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.task_history (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id),
 from_status public.task_status,
 to_status public.task_status not null,
 changed_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 comment text,
 check (to_status <> 'revision' or (comment is not null and comment ~ '[^[:space:]]'))
);
create index tasks_object_id_idx on public.tasks(object_id);
create index tasks_assignee_id_idx on public.tasks(assignee_id);
create index tasks_created_by_idx on public.tasks(created_by);
create index task_history_task_id_idx on public.task_history(task_id,created_at,id);
create index task_history_changed_by_idx on public.task_history(changed_by);

create function private.is_manager() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;
create function private.can_read_task(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.tasks t join public.objects o on o.id=t.object_id
 where t.id=p_id and t.deleted_at is null and o.deleted_at is null
 and (private.is_manager() or t.assignee_id=auth.uid()));
$$;
create function private.can_read_object(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.objects o where o.id=p_id and o.deleted_at is null
 and (private.is_manager() or exists(select 1 from public.tasks t where t.object_id=o.id and t.deleted_at is null and t.assignee_id=auth.uid())));
$$;
create function private.can_read_profile(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (p_id=auth.uid() or private.is_manager()
 or exists(select 1 from public.tasks t where (t.created_by=p_id or t.assignee_id=p_id) and private.can_read_task(t.id))
 or exists(select 1 from public.task_history h where h.changed_by=p_id and private.can_read_task(h.task_id)));
$$;
create function private.require_manager() returns void language plpgsql security definer set search_path = '' as $$
 begin if not private.is_manager() then raise exception using errcode='42501',message='FORBIDDEN'; end if; end;
$$;
create function private.validate_assignee(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
 begin
 perform 1 from public.profiles where id=p_id and role='executor' for share;
 if not found then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
 end;
$$;

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
revoke all on public.profiles,public.objects,public.tasks,public.task_history from anon,authenticated;
grant select on public.profiles,public.objects,public.tasks,public.task_history to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (private.can_read_profile(id));
create policy objects_read on public.objects for select to authenticated using (private.can_read_object(id));
create policy tasks_read on public.tasks for select to authenticated using (private.can_read_task(id));
create policy history_read on public.task_history for select to authenticated using (private.can_read_task(task_id));

create function public.create_object(p_name text,p_address text) returns public.objects language plpgsql security definer set search_path = '' as $$
 declare r public.objects;
 begin
 perform private.require_manager();
 if p_name is null or p_name !~ '[^[:space:]]' or p_address is null or p_address !~ '[^[:space:]]' then raise exception using errcode='22023',message='INVALID_INPUT'; end if;
 insert into public.objects(name,address) values(btrim(p_name),btrim(p_address)) returning * into r; return r;
 end;
$$;
create function public.update_object(p_object_id uuid,p_name text,p_address text) returns public.objects language plpgsql security definer set search_path = '' as $$
 declare r public.objects;
 begin
 perform private.require_manager();
 if p_name is null or p_name !~ '[^[:space:]]' or p_address is null or p_address !~ '[^[:space:]]' then raise exception using errcode='22023',message='INVALID_INPUT'; end if;
 update public.objects set name=btrim(p_name),address=btrim(p_address) where id=p_object_id and deleted_at is null returning * into r;
 if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if; return r;
 end;
$$;
create function public.delete_object(p_object_id uuid) returns void language plpgsql security definer set search_path = '' as $$
 begin
 perform private.require_manager();
 update public.objects set deleted_at=clock_timestamp() where id=p_object_id and deleted_at is null;
 if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 end;
$$;
create function public.create_task(p_title text,p_description text,p_object_id uuid,p_assignee_id uuid) returns public.tasks language plpgsql security definer set search_path = '' as $$
 declare r public.tasks;
 begin
 perform private.require_manager();
 if p_title is null or p_title !~ '[^[:space:]]' then raise exception using errcode='22023',message='INVALID_INPUT'; end if;
 perform 1 from public.objects where id=p_object_id and deleted_at is null for update;
 if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 perform private.validate_assignee(p_assignee_id);
 insert into public.tasks(title,description,object_id,assignee_id,created_by) values(btrim(p_title),coalesce(p_description,''),p_object_id,p_assignee_id,auth.uid()) returning * into r;
 insert into public.task_history(task_id,to_status,changed_by) values(r.id,'new',auth.uid()); return r;
 end;
$$;
-- Serialize task mutation with soft-deletion of its parent object. Recheck the
-- parent after taking the task lock, since assignment may have changed meanwhile.
create function private.lock_task(p_id uuid) returns public.tasks language plpgsql security definer set search_path = '' as $$
 declare r public.tasks; v_object uuid;
 begin
 select object_id into v_object from public.tasks where id=p_id;
 perform 1 from public.objects where id=v_object and deleted_at is null for update;
 if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 select * into r from public.tasks where id=p_id and deleted_at is null for update;
 if not found or r.object_id <> v_object then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 return r;
 end;
$$;
create function public.update_task(p_task_id uuid,p_title text,p_description text,p_object_id uuid,p_assignee_id uuid) returns public.tasks language plpgsql security definer set search_path = '' as $$
 declare r public.tasks;
 begin
 perform private.require_manager();
 if p_title is null or p_title !~ '[^[:space:]]' then raise exception using errcode='22023',message='INVALID_INPUT'; end if;
 -- Order parent locks consistently for cross-object moves.
 perform 1 from public.objects where id in (p_object_id,(select object_id from public.tasks where id=p_task_id)) order by id for update;
 r := private.lock_task(p_task_id);
 perform 1 from public.objects where id=p_object_id and deleted_at is null;
 if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 perform private.validate_assignee(p_assignee_id);
 update public.tasks set title=btrim(p_title),description=coalesce(p_description,''),object_id=p_object_id,assignee_id=p_assignee_id where id=p_task_id returning * into r;
 return r;
 end;
$$;
create function public.delete_task(p_task_id uuid) returns void language plpgsql security definer set search_path = '' as $$
 begin
 perform private.require_manager(); perform private.lock_task(p_task_id);
 update public.tasks set deleted_at=clock_timestamp() where id=p_task_id;
 end;
$$;
create function public.change_task_status(p_task_id uuid,p_target_status text,p_comment text default null) returns public.tasks language plpgsql security definer set search_path = '' as $$
 declare r public.tasks; v_old public.task_status; v_allowed boolean := false;
 begin
 if auth.uid() is null then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 if not private.can_read_task(p_task_id) then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 r := private.lock_task(p_task_id);
 if not private.is_manager() and r.assignee_id <> auth.uid() then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 v_old := r.status;
 if private.is_manager() then v_allowed := v_old='review' and p_target_status in ('accepted','revision');
 else v_allowed := (v_old in ('new','revision') and p_target_status='in_progress') or (v_old='in_progress' and p_target_status='review'); end if;
 if not coalesce(v_allowed,false) then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
 if p_target_status='revision' and (p_comment is null or p_comment !~ '[^[:space:]]') then raise exception using errcode='22023',message='COMMENT_REQUIRED'; end if;
 update public.tasks set status=p_target_status::public.task_status where id=p_task_id returning * into r;
 insert into public.task_history(task_id,from_status,to_status,changed_by,comment) values(r.id,v_old,r.status,auth.uid(),nullif(btrim(p_comment),''));
 return r;
 end;
$$;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_manager(), private.can_read_task(uuid), private.can_read_object(uuid), private.can_read_profile(uuid) to authenticated;
revoke all on function public.create_object(text,text), public.update_object(uuid,text,text), public.delete_object(uuid), public.create_task(text,text,uuid,uuid), public.update_task(uuid,text,text,uuid,uuid), public.delete_task(uuid), public.change_task_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_object(text,text), public.update_object(uuid,text,text), public.delete_object(uuid), public.create_task(text,text,uuid,uuid), public.update_task(uuid,text,text,uuid,uuid), public.delete_task(uuid), public.change_task_status(uuid,text,text) to authenticated;

