<script>
	import { resolve } from '$app/paths';
	import { initialsFromClubName } from '$lib/maritools/club-initials.js';
	import {
		CLUB_CATEGORIES,
		CLUB_CONTACT_TYPES,
		CLUB_SUBMITTER_ROLES,
		contactValueForInput,
		formatClubLinkLabel,
		joinLinkFromClub,
		normalizeContactType
	} from '$lib/maritools/club-listing.js';

	/** @type {'view' | 'edit'} */
	export let mode = 'view';
	/** @type {{ name?: string, category?: string | null, description?: string | null, links?: Array<{ type?: string, label?: string, url?: string }>, submitterRole?: string | null }} */
	export let club = {};
	/** @type {string} */
	export let backHref = '/tools/clubs';
	/** @type {string} */
	export let backLabel = '← All clubs';

	$: listing = {
		name: String(club?.name ?? ''),
		category: String(club?.category ?? ''),
		description: String(club?.description ?? ''),
		submitterRole: String(club?.submitterRole ?? ''),
		links: Array.isArray(club?.links) ? club.links : []
	};
	$: join = joinLinkFromClub(listing);

	let nextContactId = 1;
	let contacts = (Array.isArray(club?.links) ? club.links : []).map((link) => {
		const type = normalizeContactType(link.type ?? inferContactType(link.label));
		return {
			id: nextContactId++,
			type,
			label: String(link.label ?? ''),
			value: contactValueForInput(link.url, type)
		};
	});
	if (contacts.length === 0) contacts = [newContact('website')];

	/** @param {unknown} label */
	function inferContactType(label) {
		const normalized = String(label ?? '')
			.trim()
			.toLowerCase();
		return (
			CLUB_CONTACT_TYPES.find((option) => option.label.toLowerCase() === normalized)?.value ??
			'custom'
		);
	}

	/** @param {string} type */
	function newContact(type = 'website') {
		return { id: nextContactId++, type, label: '', value: '' };
	}

	function addContact() {
		contacts = [...contacts, newContact('website')];
	}

	/** @param {number} id */
	function removeContact(id) {
		contacts =
			contacts.length === 1
				? [newContact('website')]
				: contacts.filter((contact) => contact.id !== id);
	}

	/** @param {string} type */
	function contactLabel(type) {
		return CLUB_CONTACT_TYPES.find((option) => option.value === type)?.label ?? 'Link';
	}

	/** @param {string} type */
	function contactPlaceholder(type) {
		if (type === 'email' || type === 'mio') return 'club@example.com';
		if (type === 'discord') return 'discord.gg/your-club';
		if (type === 'instagram') return 'instagram.com/your-club';
		return 'your-club.example';
	}
</script>

<header class:club-editor-hero={mode === 'edit'} class="club-detail-header">
	<a href={resolve(backHref, {})}>{backLabel}</a>
	<div>
		<span class="club-initials">{initialsFromClubName(listing.name || 'New club')}</span>
		<div class="club-identity">
			{#if mode === 'edit'}
				<span class="club-editor-eyebrow">Club listing</span>
				<h1>{listing.name || 'New club'}</h1>
				<p>Build a clear page that helps students understand the club and reach you.</p>
			{:else}
				<h1>{listing.name}</h1>
				<p>{listing.category || 'General'}</p>
			{/if}
		</div>
	</div>
</header>

{#if mode === 'edit'}
	<div class="club-editor-grid" data-testid="club-listing-detail" data-mode={mode}>
		<section class="club-editor-section club-editor-basics">
			<div class="club-editor-section-heading">
				<span>01</span>
				<div>
					<h2>Listing details</h2>
					<p>Introduce the group in a way students can scan quickly.</p>
				</div>
			</div>
			<div class="club-editor-fields">
				<label class="club-editor-field club-editor-field-wide">
					<span>Club name</span>
					<input
						name="name"
						required
						maxlength="160"
						value={listing.name}
						placeholder="The Programming Club"
						data-testid="club-edit-name"
					/>
				</label>
				<label class="club-editor-field">
					<span>Your role</span>
					<select name="submitterRole" required value={listing.submitterRole}>
						<option value="">Choose one</option>
						{#each CLUB_SUBMITTER_ROLES as role (role.value)}<option value={role.value}
								>{role.label}</option
							>{/each}
					</select>
				</label>
				<label class="club-editor-field">
					<span>Category</span>
					<select
						name="category"
						required
						value={listing.category}
						data-testid="club-edit-category"
					>
						<option value="">Choose a category</option>
						{#if listing.category && !CLUB_CATEGORIES.includes(listing.category)}<option
								value={listing.category}>{listing.category}</option
							>{/if}
						{#each CLUB_CATEGORIES as category (category)}<option value={category}
								>{category}</option
							>{/each}
					</select>
				</label>
				<label class="club-editor-field club-editor-field-wide">
					<span>About the club</span>
					<textarea
						name="description"
						rows="6"
						maxlength="4000"
						placeholder="What you do, who it is for, and what a typical meeting looks like."
						data-testid="club-edit-description">{listing.description}</textarea
					>
				</label>
			</div>
		</section>

		<section class="club-editor-section club-editor-contacts">
			<div class="club-editor-section-heading">
				<span>02</span>
				<div>
					<h2>Contact and links</h2>
					<p>Add as many ways to reach the club as you need.</p>
				</div>
			</div>
			<div class="club-contact-list">
				{#each contacts as contact (contact.id)}
					<div class="club-contact-card">
						<label class="club-editor-field">
							<span>Contact type</span>
							<select name="contactType" bind:value={contact.type}>
								{#each CLUB_CONTACT_TYPES as option (option.value)}<option value={option.value}
										>{option.label}</option
									>{/each}
							</select>
						</label>
						{#if contact.type === 'custom'}
							<label class="club-editor-field"
								><span>Label</span><input
									name="contactLabel"
									bind:value={contact.label}
									maxlength="80"
									placeholder="Linktree"
								/></label
							>
						{:else}
							<input type="hidden" name="contactLabel" value={contactLabel(contact.type)} />
						{/if}
						<label class="club-editor-field club-contact-value">
							<span>{contact.type === 'email' || contact.type === 'mio' ? 'Address' : 'Link'}</span>
							<input
								name="contactValue"
								type={contact.type === 'email' || contact.type === 'mio' ? 'email' : 'text'}
								bind:value={contact.value}
								maxlength="500"
								placeholder={contactPlaceholder(contact.type)}
							/>
						</label>
						<button
							type="button"
							class="club-contact-remove"
							on:click={() => removeContact(contact.id)}
							aria-label="Remove contact method"
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
						</button>
					</div>
				{/each}
			</div>
			<button type="button" class="club-contact-add" on:click={addContact}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
				Add contact method
			</button>
		</section>
	</div>
{:else}
	<div class="club-detail-index" data-testid="club-listing-detail" data-mode={mode}>
		<section>
			<h2>About</h2>
			{#if listing.description}<p>{listing.description}</p>{:else}<p>
					No description published yet.
				</p>{/if}
		</section>
		<section>
			<h2>Contact and links</h2>
			{#if listing.links.length > 0}
				{#each listing.links as link, index (`${link.url}-${index}`)}
					<div class="club-link-row">
						<span>{link.label ?? 'Link'}</span><a href={link.url} rel="external noopener noreferrer"
							>{formatClubLinkLabel(link)}</a
						>
					</div>
				{/each}
			{:else}<p>No links published yet.</p>{/if}
		</section>
		<section>
			<h2>How to join</h2>
			{#if join}
				<p>Open the signup link, then follow the club's published channels for meeting details.</p>
				<a class="primary-button" href={join.url} rel="external noopener noreferrer"
					>Sign up for the club</a
				>
			{:else}<p>Use the published links above to get in touch.</p>{/if}
		</section>
	</div>
{/if}
