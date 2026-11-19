/** Browser file helpers shared by the beat map hub and the composer. */

let picker: HTMLInputElement | null = null;

/** Open the system file dialog. Resolves with null if the player cancels. */
export function pickFile(accept: string): Promise<File | null> {
  disposePicker();
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      if (picker === input) disposePicker();
      else input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    picker = input;
    input.click();
  });
}

/** Remove a file input left behind by a dialog that never reported back. */
export function disposePicker(): void {
  picker?.remove();
  picker = null;
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** A file name that is safe on every platform, without extension. */
export function safeFileName(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[^a-z0-9 _-]+/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return cleaned || 'beat-map';
}

/** Drop the extension from an audio file name for use as a song title. */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return (dot > 0 ? fileName.slice(0, dot) : fileName).slice(0, 60);
}
