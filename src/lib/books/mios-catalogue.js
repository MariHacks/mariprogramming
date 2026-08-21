export const MIOS_CATALOGUE_FIELDS = Object.freeze([
	'courseCode',
	'section',
	'title',
	'instructor',
	'author',
	'bookTitle',
	'edition',
	'isbn',
	'bookstore',
	'notes',
	'sourceDate'
]);

export const MIOS_CATALOGUE_CONTACT = Object.freeze({
	email: 'team@marihacks.com',
	instagram: '@marihacks'
});

export const MIOS_CATALOGUE_SOURCE = Object.freeze({
	teacher: 'Mios',
	date: '2026-08-20',
	updatedAt: '2026-08-20T19:09:00-04:00',
	updatedAtLabel: '19:09 America/Toronto'
});

/**
 * @param {string} name
 */
export function instructorSlug(name) {
	return name
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-+|-+$/gu, '');
}

/**
 * @param {{ instructor: string, courseCode: string, section: string, bookTitle: string }} row
 */
export function miosEntryKey(row) {
	return `${instructorSlug(row.instructor)}|${row.courseCode}|${row.section}|${row.bookTitle}`;
}

/**
 * @param {{
 *   courseCode: string, section: string, title: string, instructor: string,
 *   author: string, bookTitle: string, edition: string, isbn: string,
 *   bookstore: string, notes: string, sourceDate: string
 * }} row
 */
export function miosEntryFormValues(row) {
	return {
		courseCode: row.courseCode,
		section: row.section,
		title: row.title,
		instructor: row.instructor,
		author: row.author,
		bookTitle: row.bookTitle,
		edition: row.edition,
		isbn: row.isbn,
		bookstore: row.bookstore,
		notes: row.notes,
		sourceDate: row.sourceDate
	};
}

/**
 * @param {{
 *   courseCode: string, section: string, title: string, instructor: string,
 *   bookTitle: string, sourceDate: string, author?: string, edition?: string,
 *   isbn?: string, bookstore?: string, notes?: string, priceCents?: number | null
 * }} row
 */
function entry(row) {
	return Object.freeze({
		courseCode: row.courseCode,
		section: row.section,
		title: row.title,
		instructor: row.instructor,
		author: row.author ?? '',
		bookTitle: row.bookTitle,
		edition: row.edition ?? '',
		isbn: row.isbn ?? '',
		bookstore: row.bookstore ?? '',
		notes: row.notes ?? '',
		sourceDate: row.sourceDate,
		priceCents: row.priceCents ?? null
	});
}

export const MIOS_CATALOGUE_ENTRIES = Object.freeze([
	entry({
		courseCode: '603-101-MQ',
		section: '01',
		title: 'Composition and Literature: Intro to College English',
		instructor: 'Philip Dann',
		author: 'Sayaka Murata',
		bookTitle: 'Convenience Store Woman',
		isbn: '978-0-8021-2962-8',
		bookstore: "The Book Stop (Follett's), Concordia Loyola, 7141 Sherbrooke W, CJ1 422",
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '603-103-MQ',
		section: '71',
		title: 'Literary Themes (A&S and Liberal Arts)',
		instructor: 'Philip Dann',
		author: 'Jane Austen',
		bookTitle: 'Mansfield Park',
		edition: 'Broadview 2003, ed. June Sturrock',
		isbn: '978-1551110981',
		bookstore: "The Book Stop (Follett's), Concordia Loyola",
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '603-103-MQ',
		section: '71',
		title: 'Literary Themes (A&S and Liberal Arts)',
		instructor: 'Philip Dann',
		author: 'Richard Marsh',
		bookTitle: 'The Beetle',
		edition: 'Broadview 2004, ed. Julian Wolfreys',
		isbn: '978-1551114439',
		bookstore: "The Book Stop (Follett's), Concordia Loyola",
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '603-103-MQ',
		section: '19',
		title: '(title not in Mio)',
		instructor: 'Blair Morris',
		bookTitle: 'Macbeth',
		bookstore: 'The Book Stop, Concordia Loyola',
		notes: 'class Mio; no edition/ISBN',
		sourceDate: '2026-08-16'
	}),
	entry({
		courseCode: '603-103-MQ',
		section: '19',
		title: '(title not in Mio)',
		instructor: 'Blair Morris',
		bookTitle: 'Henry IV (part not specified)',
		bookstore: 'The Book Stop, Concordia Loyola',
		notes: 'no edition/ISBN',
		sourceDate: '2026-08-16'
	}),
	entry({
		courseCode: '603-103-MQ',
		section: '19',
		title: '(title not in Mio)',
		instructor: 'Blair Morris',
		bookTitle: 'Henry VIII',
		bookstore: 'The Book Stop, Concordia Loyola',
		notes: 'no edition/ISBN',
		sourceDate: '2026-08-16'
	}),
	entry({
		courseCode: '602-103-MQ',
		section: '03',
		title: 'Arts et littérature en France',
		instructor: 'Magali Gasse-Houle',
		author: 'Honoré de Balzac',
		bookTitle: "Le Chef-d'oeuvre inconnu",
		edition: 'Gallimard Folio classique',
		isbn: '978-2-07-046284-1',
		bookstore: 'Renaud Bray; Multimags 5508 Monkland',
		notes: 'syllabus price',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '11, 12',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Tessa Morin Cabana',
		author: 'Guy de Maupassant',
		bookTitle: 'Bel-Ami',
		edition: 'Gallimard 1999 [1885]',
		bookstore: 'Zone libre',
		notes: 'already ordered',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '11, 12',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Tessa Morin Cabana',
		author: 'Marie Darrieussecq',
		bookTitle: 'Notre vie dans les forêts',
		edition: 'Gallimard 2019',
		bookstore: 'Zone libre',
		notes: 'already ordered',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '11, 12',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Tessa Morin Cabana',
		author: 'Groleau/Thérien',
		bookTitle: "L'Abrégé : guide des notions littéraires",
		edition: 'CEC 2018',
		bookstore: 'Zone libre',
		notes: 'already ordered',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '08, 09',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Tessa Morin Cabana',
		author: 'Mireille Gagné',
		bookTitle: "Le lièvre d'Amérique",
		edition: 'Le livre de poche 2022',
		notes: 'store not named',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '08, 09',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Tessa Morin Cabana',
		author: 'Emmanuelle Jimenez',
		bookTitle: 'Fondre',
		edition: 'Atelier 10 2026',
		notes: 'store not named',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '08, 09',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Tessa Morin Cabana',
		author: 'Thélyson Orélien',
		bookTitle: "C'était ça ou mourir",
		edition: 'Boréal 2026',
		notes: 'store not named',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '16',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Xavier Phaneuf-Jolicoeur',
		author: 'Groleau/Thérien',
		bookTitle: "L'abrégé",
		edition: '3e éd., CEC 2018',
		bookstore: 'Le Port de tête, 269 Mont-Royal Est',
		notes: 'already arrived; buy there. Plan said 24$ (estimate)',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '16',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Xavier Phaneuf-Jolicoeur',
		author: 'Guy de Maupassant',
		bookTitle: 'Boule de suif',
		edition: 'Folio classique 1999 [1880]',
		bookstore: 'Le Port de tête',
		notes: 'plan said 4$ (estimate, not a discount)',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '16',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Xavier Phaneuf-Jolicoeur',
		author: 'Guy de Maupassant',
		bookTitle: 'Le Horla',
		edition: 'Folio classique 2014 [1886]',
		bookstore: 'Le Port de tête',
		notes: 'plan said 6$',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '16',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Xavier Phaneuf-Jolicoeur',
		author: 'Marguerite Duras',
		bookTitle: 'Moderato cantabile',
		edition: 'Minuit Double 1980 [1958]',
		bookstore: 'Le Port de tête',
		notes: 'plan said 16$',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF0-MQ',
		section: '16',
		title: 'Oeuvres narratives et écriture',
		instructor: 'Xavier Phaneuf-Jolicoeur',
		author: 'Emmanuel Carrère',
		bookTitle: "L'Adversaire",
		edition: 'Folio 2001 [2000]',
		bookstore: 'Le Port de tête',
		notes: 'plan said 14$',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '03',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Lily Soucy',
		author: 'Wajdi Mouawad',
		bookTitle: 'Incendies',
		edition: 'Leméac Nomades 2015',
		bookstore: 'Le Port de tête',
		notes: 'plan 11,95$; needed by 28 Aug',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '03',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Lily Soucy',
		author: 'Wajdi Mouawad',
		bookTitle: 'Littoral',
		edition: 'Leméac Nomades 2015',
		bookstore: 'Le Port de tête',
		notes: 'plan 12,95$',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '03',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Lily Soucy',
		author: 'Évelyne de la Chenelière',
		bookTitle: 'Bashir Lazhar',
		edition: 'Leméac 2011',
		bookstore: 'Le Port de tête',
		notes: 'plan 12,95$',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '03',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Lily Soucy',
		author: 'Kim Thúy',
		bookTitle: 'Ru',
		edition: 'Éditions 10 sur 10 2014',
		bookstore: 'Le Port de tête',
		notes: 'plan 14,95$',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '03',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Lily Soucy',
		author: 'Groleau/Thérien',
		bookTitle: "L'Abrégé",
		edition: 'CEC 2018',
		bookstore: 'Le Port de tête',
		notes: 'plan 24,95$',
		sourceDate: '2026-08-20'
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '07 (PDF; asked 14, 15)',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Laurence Sylvain',
		author: 'Groleau/Thérien',
		bookTitle: "L'Abrégé",
		edition: '3e éd., CEC 2018',
		bookstore: 'Zone libre, 262 Ste-Catherine Est',
		notes: '25,47$ incl. 10–15% student rabais + taxes; confirm 14/15',
		sourceDate: '2026-08-20',
		priceCents: 2547
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '07 (PDF; asked 14, 15)',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Laurence Sylvain',
		author: 'Joséphine Bacon',
		bookTitle: 'Un thé dans la toundra / Nipishapui nete mushua',
		edition: "Mémoire d'encrier 2009",
		bookstore: 'Zone libre',
		notes: '16,07$ incl. rabais + taxes',
		sourceDate: '2026-08-20',
		priceCents: 1607
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '07 (PDF; asked 14, 15)',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Laurence Sylvain',
		author: 'Caroline Dawson',
		bookTitle: 'Là où je me terre',
		edition: 'Remue-Ménage 2020',
		bookstore: 'Zone libre',
		notes: '21,69$ incl. rabais + taxes',
		sourceDate: '2026-08-20',
		priceCents: 2169
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '07 (PDF; asked 14, 15)',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Laurence Sylvain',
		author: 'Alfred Desrochers',
		bookTitle: "À l'ombre de l'Orford",
		edition: 'Fides 2012',
		bookstore: 'Zone libre',
		notes: '13,18$ incl. rabais + taxes',
		sourceDate: '2026-08-20',
		priceCents: 1318
	}),
	entry({
		courseCode: '602-UF2-MQ',
		section: '07 (PDF; asked 14, 15)',
		title: "Comparaison d'oeuvres littéraires",
		instructor: 'Laurence Sylvain',
		author: 'Laurence Sylvain',
		bookTitle: 'La dissertation critique comparative critique (guide méthodologique)',
		notes: '10,92$ taxes; her own guide, not listed as Zone libre',
		sourceDate: '2026-08-20',
		priceCents: 1092
	}),
	entry({
		courseCode: '603-101-MQ',
		section: '17 (PDF; asked 18)',
		title: 'Introduction to College English: Literature',
		instructor: 'Natalie Huffels',
		author: 'Wes Anderson',
		bookTitle: 'The Grand Budapest Hotel: The Screenplay',
		edition: 'Faber 2025',
		isbn: '9780571397266',
		bookstore: 'The Book Stop, Concordia Loyola',
		notes: 'confirm 18 vs 17',
		sourceDate: '2026-08-20'
	})
]);

export const MIOS_CATALOGUE_SKIPPED = Object.freeze([
	Object.freeze({
		instructor: 'Newell',
		courseCode: '603-101-MQ',
		section: '24',
		reason: 'course pack',
		outOfCatalog: true
	}),
	Object.freeze({
		instructor: 'Newell',
		courseCode: '603-103-MQ',
		section: '20',
		reason: 'course pack',
		outOfCatalog: true
	}),
	Object.freeze({
		instructor: 'Boudreau',
		courseCode: '603-101-MQ',
		section: '28',
		reason: 'course pack',
		outOfCatalog: true
	}),
	Object.freeze({
		instructor: 'Fitz-James',
		courseCode: '603-101-MQ',
		section: '71',
		reason: 'course pack',
		outOfCatalog: true
	}),
	Object.freeze({
		instructor: 'Burton',
		courseCode: '603-101-MQ',
		section: '06',
		reason: 'library course pack',
		outOfCatalog: true
	}),
	Object.freeze({
		instructor: 'Natalie Huffels',
		courseCode: 'Eastman',
		section: '2026 pack',
		reason: '2-part Eastman course pack (https://epacks.eastman.ca)',
		outOfCatalog: true
	})
]);

export const MIOS_CATALOGUE_NOTICES = Object.freeze([
	'Petruzziello: unnamed independent store with a student discount. No name yet. Out sick through 2026-08-24. No catalog rows.',
	'Syllabus and plan dollar amounts are cover/plan estimates, not promised store prices, except Laurence Sylvain: her prices include a real 10–15% Zone libre student discount plus tax.',
	'Blank ISBN, edition, bookstore, or price means the teacher did not give it. Do not invent values.'
]);

export const MIOS_CATALOGUE_BOOKSTORES = Object.freeze([
	Object.freeze({
		name: "The Book Stop (Follett's), Concordia Loyola",
		address: '7141 Sherbrooke St W, CJ1 422',
		notes:
			'Online: ship to either Concordia campus free, or home (Dann: flat fee; Morris/Huffels: $7.99). Used by Philip Dann, Blair Morris, Natalie Huffels (screenplay).'
	}),
	Object.freeze({
		name: 'Renaud Bray; Multimags',
		address: 'Multimags, 5508 avenue Monkland. Renaud Bray (various).',
		notes: 'Magali Gasse-Houle.'
	}),
	Object.freeze({
		name: 'Zone libre',
		address: '262 rue Sainte-Catherine Est (métro Berri-UQAM)',
		notes:
			'Tessa Morin Cabana UF0 s11–s12 (already ordered). Laurence Sylvain literary works (10–15% student discount).'
	}),
	Object.freeze({
		name: 'Librairie Le Port de tête',
		address: '269 avenue du Mont-Royal Est (métro Mont-Royal)',
		notes:
			'514-678-9566; librairie@leportdetete.com. Xavier Phaneuf-Jolicoeur (already arrived; buy there so they are not left with unsold copies). Lily Soucy (needed by 28 Aug; no digital in class).'
	})
]);
