INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
VALUES (
	'70000000-0000-4000-8000-000000000001',
	'Programming Club Staff',
	'team@marihacks.com',
	true,
	now(),
	now()
);

INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at)
VALUES (
	'live-e2e-google-account',
	'live-e2e-google-subject',
	'google',
	'70000000-0000-4000-8000-000000000001',
	now(),
	now()
);

INSERT INTO teachers (id, slug, name)
VALUES (
	'10000000-0000-4000-8000-000000000001',
	'prof-ada-lovelace',
	'Prof. Ada Lovelace'
);

INSERT INTO courses (id, teacher_id, code, title)
VALUES (
	'20000000-0000-4000-8000-000000000001',
	'10000000-0000-4000-8000-000000000001',
	'CSC 205',
	'Data Structures'
);

INSERT INTO bookstores (id, name, service_fee_cents)
VALUES (
	'30000000-0000-4000-8000-000000000001',
	'Campus Books',
	500
);

INSERT INTO books (
	id,
	bookstore_id,
	title,
	author,
	isbn,
	retailer_url,
	cover_url,
	price_cents
)
VALUES
	(
		'40000000-0000-4000-8000-000000000001',
		'30000000-0000-4000-8000-000000000001',
		'Data Structures and Algorithm Analysis',
		'Mark Allen Weiss',
		'9780132847377',
		'https://shop.mariprogramming.dev/data-structures',
		null,
		4299
	),
	(
		'40000000-0000-4000-8000-000000000002',
		'30000000-0000-4000-8000-000000000001',
		'Clean Code',
		'Robert C. Martin',
		'9780132350884',
		'https://shop.mariprogramming.dev/clean-code',
		null,
		3999
	);

INSERT INTO course_books (id, course_id, book_id, position)
VALUES
	(
		'50000000-0000-4000-8000-000000000001',
		'20000000-0000-4000-8000-000000000001',
		'40000000-0000-4000-8000-000000000001',
		0
	),
	(
		'50000000-0000-4000-8000-000000000002',
		'20000000-0000-4000-8000-000000000001',
		'40000000-0000-4000-8000-000000000002',
		1
	);
