CREATE POLICY "user_roles_insert_own_organizer"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'ORGANIZER');