create policy "No direct client access to CAN upload metadata"
on public.can_uploads
for all
to public
using (false)
with check (false);