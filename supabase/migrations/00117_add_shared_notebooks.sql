create table shared_notebooks (
  conversation_id text not null primary key,
  encrypted_content text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table shared_notebooks is 'Stores ciphertext-only shared notebooks for 1:1 conversations; keys are client-side derived from the Double Ratchet session.';

alter table shared_notebooks enable row level security;

-- Helper: is the current user a participant in this conversation?
-- Uses a security definer function to avoid the RLS self-loop on contacts.
create or replace function _is_conversation_participant(conv_id text, uid uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from contacts
    where conversation_id = conv_id
      and owner_id = uid
  );
$$;

-- Only conversation participants can view their shared notebook.
create policy "Participants can select shared notebook"
  on shared_notebooks
  for select
  to authenticated
  using (
    _is_conversation_participant(conversation_id, auth.uid())
  );

-- Only conversation participants can insert a shared notebook for their conversation.
create policy "Participants can insert shared notebook"
  on shared_notebooks
  for insert
  to authenticated
  with check (
    _is_conversation_participant(conversation_id, auth.uid())
  );

-- Only conversation participants can update the shared notebook.
create policy "Participants can update shared notebook"
  on shared_notebooks
  for update
  to authenticated
  using (
    _is_conversation_participant(conversation_id, auth.uid())
  )
  with check (
    _is_conversation_participant(conversation_id, auth.uid())
  );

-- Only conversation participants can delete their shared notebook.
create policy "Participants can delete shared notebook"
  on shared_notebooks
  for delete
  to authenticated
  using (
    _is_conversation_participant(conversation_id, auth.uid())
  );

-- Realtime publication so clients can subscribe to notebook changes.
alter publication supabase_realtime add table shared_notebooks;
