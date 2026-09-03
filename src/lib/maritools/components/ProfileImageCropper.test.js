import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileImageCropper from './ProfileImageCropper.svelte';
import { readFileSync } from 'node:fs';

const cropperSource = readFileSync('src/lib/maritools/components/ProfileImageCropper.svelte', 'utf8');

/** @type {WeakMap<HTMLInputElement, FileList | null>} */
let assignedFiles = new WeakMap();

class MockImage {
	/** @type {(() => void) | undefined} */
	onload;
	constructor() {
		this.naturalWidth = 1200;
		this.naturalHeight = 800;
	}

	/** @param {string} _value */
	set src(_value) {
		queueMicrotask(() => this.onload?.());
	}
}

class MockDataTransfer {
	/** @type {{ files: File[], add: (file: File) => void }} */
	items = {
		files: [],
		/** @param {File} file */
		add: (file) => this.items.files.push(file)
	};

	get files() {
		return /** @type {FileList} */ (
			Object.assign([...this.items.files], {
				/** @param {number} index */
				item: (index) => this.items.files[index] ?? null
			})
		);
	}
}

beforeEach(() => {
	assignedFiles = new WeakMap();
	vi.spyOn(HTMLInputElement.prototype, 'files', 'get').mockImplementation(
		/** @this {HTMLInputElement} */ function () {
			return assignedFiles.get(this) ?? null;
		}
	);
	vi.spyOn(HTMLInputElement.prototype, 'files', 'set').mockImplementation(
		/** @this {HTMLInputElement} */ function (files) {
			assignedFiles.set(this, files);
		}
	);
	vi.stubGlobal('Image', MockImage);
	vi.stubGlobal('DataTransfer', MockDataTransfer);
	vi.stubGlobal('URL', {
		createObjectURL: vi.fn(() => 'blob:avatar'),
		revokeObjectURL: vi.fn()
	});
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		/** @type {CanvasRenderingContext2D} */ (
			/** @type {unknown} */ ({
				clearRect: vi.fn(),
				drawImage: vi.fn()
			})
		)
	);
	vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
		/** @param {BlobCallback} callback */ (callback) => {
			callback(new Blob(['cropped-avatar'], { type: 'image/webp' }));
		}
	);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('ProfileImageCropper', () => {
	it('opens an accessible crop dialog and restores focus when cancelled', async () => {
		const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
		render(ProfileImageCropper, { props: { id: 'avatar', label: 'Profile picture' } });
		const choose = screen.getByRole('button', { name: 'Choose image' });
		const picker = screen.getByLabelText('Choose profile picture file');

		await fireEvent.change(picker, {
			target: { files: [new File(['image'], 'portrait.png', { type: 'image/png' })] }
		});

		expect(await screen.findByRole('dialog', { name: 'Crop profile picture' })).toBeInTheDocument();
		const usePhoto = screen.getByRole('button', { name: 'Use photo' });
		expect(
			focusSpy.mock.calls.some(
				(call, index) => focusSpy.mock.contexts[index] === usePhoto && call[0]?.preventScroll === true
			)
		).toBe(true);
		expect(picker).not.toBeVisible();
		expect(screen.getByTestId('cropped-profile-image')).not.toBeVisible();
		expect(screen.getByLabelText('Zoom')).toHaveValue('1');
		expect(screen.getByLabelText('Horizontal position')).toHaveValue('0');
		expect(screen.getByLabelText('Vertical position')).toHaveValue('0');

		await fireEvent.input(screen.getByLabelText('Horizontal position'), {
			target: { value: '0.6' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
		expect(screen.getByLabelText('Horizontal position')).toHaveValue('0');
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(choose).toHaveFocus();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar');
	});

	it('uses a viewport-height mobile dialog with persistent header and actions', () => {
		expect(cropperSource).toContain('height: 100dvh;');
		expect(cropperSource).toMatch(/\.crop-dialog header\s*\{[^}]*position: sticky;/su);
		expect(cropperSource).toMatch(/\.crop-dialog footer\s*\{[^}]*position: sticky;/su);
		expect(cropperSource).toMatch(/\.crop-dialog footer\s*\{[^}]*flex-direction: row;/su);
	});

	it('creates a square WebP file and exposes it through the multipart field', async () => {
		render(ProfileImageCropper, {
			props: { id: 'avatar', label: 'Profile picture', name: 'profileImage' }
		});
		await fireEvent.change(screen.getByLabelText('Choose profile picture file'), {
			target: { files: [new File(['image'], 'portrait.png', { type: 'image/png' })] }
		});
		await screen.findByRole('dialog');
		await fireEvent.input(screen.getByLabelText('Zoom'), { target: { value: '1.5' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		const output = screen.getByTestId('cropped-profile-image');
		expect(output).toBeInstanceOf(HTMLInputElement);
		if (!(output instanceof HTMLInputElement)) throw new Error('Expected a file input');
		expect(output).toHaveAttribute('name', 'profileImage');
		const files = output.files;
		expect(files).not.toBeNull();
		if (!files) throw new Error('Expected a cropped file');
		expect(files).toHaveLength(1);
		expect(files[0]).toMatchObject({ type: 'image/webp' });
		expect(screen.getByRole('img', { name: 'Selected avatar' })).toHaveAttribute(
			'src',
			'blob:avatar'
		);
	});

	it('rejects animated GIFs before opening the cropper', async () => {
		render(ProfileImageCropper, { props: { id: 'avatar', label: 'Profile picture' } });
		await fireEvent.change(screen.getByLabelText('Choose profile picture file'), {
			target: { files: [new File(['gif'], 'animated.gif', { type: 'image/gif' })] }
		});

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Choose a JPEG, PNG, or WebP image.'
		);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('does not commit an encoded photo after the dialog is cancelled', async () => {
		const encoding = { current: /** @type {BlobCallback | null} */ (null) };
		vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
			encoding.current = callback;
		});
		render(ProfileImageCropper, { props: { id: 'avatar', label: 'Profile picture' } });
		await fireEvent.change(screen.getByLabelText('Choose profile picture file'), {
			target: { files: [new File(['image'], 'portrait.png', { type: 'image/png' })] }
		});
		await screen.findByRole('dialog');
		await fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		encoding.current?.(new Blob(['late'], { type: 'image/webp' }));
		await Promise.resolve();

		expect(screen.queryByRole('img', { name: 'Selected avatar' })).not.toBeInTheDocument();
		expect(screen.getByText('No image selected')).toBeInTheDocument();
	});
});
