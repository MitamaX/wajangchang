import { pixelRatio, prefersReducedMotion } from '../core/display.js';
import { REPORT_ASPECT, STAMP_DELAY, drawReportCard } from '../report/ReportCard.js';
import { byId } from './dom.js';
import { Meter } from './Meter.js';

const CARD_SECONDS = 1.5;

export class ResultDialog {
  constructor({ onShare, onSave, onContinue }) {
    this.root = byId('result');
    this.reportFrame = byId('reportFrame');
    this.card = byId('reportCanvas');
    this.share = byId('share');
    this.preview = byId('preview');
    this.video = byId('previewVideo');
    this.poster = byId('previewPoster');
    this.render = byId('render');
    this.renderMeter = new Meter(byId('renderMeter'), byId('renderFill'), byId('renderPercent'));
    this.note = byId('shareNote');
    this.shareButton = byId('shareButton');
    this.saveButton = byId('saveButton');
    this.saveLabel = byId('saveLabel');
    this.animation = 0;
    this.stampTimer = 0;
    this.url = null;
    this.reportFrame.addEventListener('click', () => this.reveal());
    this.shareButton.addEventListener('click', onShare);
    this.saveButton.addEventListener('click', onSave);
    byId('continueButton').addEventListener('click', onContinue);
  }

  get open() {
    return !this.root.hidden;
  }

  present(report, seal, onStamp) {
    this.root.hidden = false;
    this.reset();
    this.animateCard(report, seal);
    clearTimeout(this.stampTimer);
    this.stampTimer = setTimeout(onStamp, prefersReducedMotion() ? 0 : STAMP_DELAY);
  }

  settle() {
    this.reportFrame.disabled = false;
    this.reportFrame.focus({ preventScroll: true });
  }

  reveal() {
    this.reportFrame.hidden = true;
    this.share.hidden = false;
    this.shareButton.focus({ preventScroll: true });
  }

  reset() {
    this.reportFrame.disabled = true;
    this.reportFrame.hidden = false;
    this.share.hidden = true;
    this.releaseVideo();
    this.video.hidden = true;
    this.render.hidden = false;
    this.renderMeter.show(0);
    this.saveLabel.textContent = '영상 저장';
    this.shareButton.disabled = true;
    this.saveButton.disabled = true;
    this.showNote('');
  }

  animateCard(report, seal) {
    cancelAnimationFrame(this.animation);
    const ratio = pixelRatio();
    const width = this.card.clientWidth;
    this.card.width = Math.round(width * ratio);
    this.card.height = Math.round((width / REPORT_ASPECT) * ratio);
    const context = this.card.getContext('2d');
    const started = performance.now();
    const paint = (now) => {
      const time = prefersReducedMotion() ? CARD_SECONDS : (now - started) / 1000;
      context.clearRect(0, 0, this.card.width, this.card.height);
      drawReportCard(context, this.card.width, this.card.height, report, time, seal);
      if (time < CARD_SECONDS) this.animation = requestAnimationFrame(paint);
      else this.settle();
    };
    this.animation = requestAnimationFrame(paint);
  }

  showPoster(canvas) {
    this.preview.style.setProperty('--preview-aspect', String(canvas.width / canvas.height));
    this.poster.src = canvas.toDataURL('image/jpeg', 0.85);
  }

  showPreview(blob) {
    this.url = URL.createObjectURL(blob);
    this.video.onloadeddata = () => {
      this.video.hidden = false;
      this.video.play().catch(() => {});
    };
    this.video.src = this.url;
  }

  showProgress(fraction) {
    this.renderMeter.show(fraction);
  }

  showMedia(file) {
    this.render.hidden = true;
    this.saveLabel.textContent = file.type.startsWith('video/') ? '영상 저장' : '이미지 저장';
    this.shareButton.disabled = false;
    this.saveButton.disabled = false;
  }

  showNote(text) {
    this.note.textContent = text;
    this.note.hidden = !text;
  }

  releaseVideo() {
    this.video.pause();
    this.video.removeAttribute('src');
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }

  close() {
    cancelAnimationFrame(this.animation);
    clearTimeout(this.stampTimer);
    this.releaseVideo();
    this.root.hidden = true;
  }
}
