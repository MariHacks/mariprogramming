DO $grant$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mariprogramming_runtime') THEN
		EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
			"mt_google_calendar_grants",
			"mt_free_time_boards",
			"mt_free_time_members",
			"mt_saved_schedules",
			"mt_programming_club_memberships"
		TO mariprogramming_runtime';
	END IF;
END
$grant$;
