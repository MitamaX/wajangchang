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

  static intentUrl(text) {
    return `${INTENT_URL}?text=${encodeURIComponent(text)}`;
  }

  async post(file, text) {
    if (ShareKit.canShareFile(file)) {
      try {
        await navigator.share({ files: [file], text });
        return 'shared';
      } catch (error) {
        if (error && error.name === 'AbortError') return 'cancelled';
      }
    }
    const copied = this.copy(text);
    this.save(file);
    window.open(ShareKit.intentUrl(text), '_blank', 'noopener');
    return (await copied) ? 'handoff-copied' : 'handoff';
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

  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
