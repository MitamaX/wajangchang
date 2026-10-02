const INTENT_URL = 'https://x.com/intent/post';
const REVOKE_DELAY = 4000;

export class ShareKit {
  static canShareFile(file) {
    try {
      return Boolean(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch {
      return false;
    }
  }

  async post(file) {
    if (ShareKit.canShareFile(file)) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    this.save(file);
    window.open(INTENT_URL, '_blank', 'noopener');
  }

  save(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
  }
}
