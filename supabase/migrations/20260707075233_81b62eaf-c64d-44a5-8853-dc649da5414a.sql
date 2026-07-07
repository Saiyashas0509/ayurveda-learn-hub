
-- course-media: faculty/admin write, all authenticated read
CREATE POLICY "course_media_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-media');

CREATE POLICY "course_media_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-media'
  AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role)));

CREATE POLICY "course_media_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-media'
  AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role)));

CREATE POLICY "course_media_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-media'
  AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role)));

-- assignment-submissions: student writes own folder, faculty/admin read all
CREATE POLICY "sub_student_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sub_student_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sub_student_read_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assignment-submissions'
  AND ((storage.foldername(name))[1] = auth.uid()::text
    OR private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'trainer'::app_role)
    OR private.has_role(auth.uid(), 'faculty'::app_role)));
