import { SoundBoard } from '../audio/SoundBoard.js';
import { COMPLETION, RECORDING, VIEW } from '../config.js';
import { createCanvas } from '../core/canvas.js';
import { pixelRatio, prefersReducedMotion } from '../core/display.js';
import { loadFonts } from '../core/fonts.js';
import { coverThumbnail } from '../core/images.js';
import { fileSafe } from '../core/naming.js';
import { MATERIALS } from '../destruction/materials.js';
import { Specimen } from '../destruction/Specimen.js';
import { composeFrame } from '../media/frames.js';
import { Recorder, frameSize } from '../media/Recorder.js';
import { ShareKit } from '../media/ShareKit.js';
import { Renderer } from '../render/Renderer.js';
import { buildReport, shareText } from '../report/Report.js';
import { STAMP_DELAY, makeSeal, paintOutro } from '../report/ReportCard.js';
import { SAMPLES } from '../samples/samples.js';
import { ARSENAL } from '../scene/arsenal.js';
import { Camera, Room } from '../scene/Camera.js';
import { Session } from '../scene/Session.js';
import { byId } from '../ui/dom.js';
import { ImageIntake } from '../ui/ImageIntake.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { ResultDialog } from '../ui/ResultDialog.js';
import { SetupPanel } from '../ui/SetupPanel.js';
import { StageInput } from '../ui/StageInput.js';
import { StatusBar } from '../ui/StatusBar.js';
import { Toast } from '../ui/Toast.js';
import { ToolRack } from '../ui/ToolRack.js';

const MAX_FRAME_SECONDS = 0.05;
const THUMB_SIZE = 220;
const PLACEHOLDER_METERS = 0.6;
const DEFAULT_SAMPLE = 'monday';
const DEFAULT_MATERIAL = 'glass';
const REPORT_FONT_TIMEOUT = 1500;
const FILE_PREFIX = '와장창_';
const PAUSE_KEY = 'Escape';
const OUTRO_CUES = [{ name: 'stamp', offset: STAMP_DELAY / 1000 }];

const Phase = Object.freeze({ SETUP: 'setup', PLAYING: 'playing', PAUSED: 'paused', SETTLING: 'settling', DONE: 'done' });
const PAUSABLE = new Set([Phase.PLAYING, Phase.PAUSED]);
const FROZEN = new Set([Phase.PAUSED, Phase.DONE]);

const SHARE_NOTES = Object.freeze({
  shared: '',
  cancelled: '',
  'handoff-copied': '저장 · 문구 복사 · X 열림',
  handoff: '저장 · X 열림',
});

function pngFile(canvas, name) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(new File([blob], name, { type: 'image/png' })), 'image/png');
  });
}

export class App {
  constructor() {
    this.canvas = byId('stage');
    this.wrap = byId('stageWrap');
    this.renderer = new Renderer(this.canvas, byId('spill'));
    this.camera = new Camera();
    this.sound = new SoundBoard();
    this.recorder = new Recorder();
    this.shareKit = new ShareKit();
    this.toast = new Toast(byId('toast'));
    this.pauseButton = byId('pauseButton');
    this.session = null;
    this.subject = null;
    this.materialKey = DEFAULT_MATERIAL;
    this.enter(Phase.SETUP);
    this.settleStart = 0;
    this.report = null;
    this.shareFile = null;
    this.viewWidth = 1;
    this.viewHeight = 1;
    this.lastFrame = performance.now() / 1000;
    this.carry = 0;
    this.status = new StatusBar();
    this.intake = new ImageIntake({
      canAccept: () => this.phase === Phase.SETUP,
      onImage: this.byUser((source, name) => this.useImage(source, name, null)),
      onError: (message) => this.toast.show(message),
    });
    this.setup = new SetupPanel({
      onMaterial: this.byUser((key) => this.prepare(key)),
      onSample: this.byUser((key) => this.useSample(key)),
      onUpload: () => this.intake.pick(),
      onStart: () => this.start(),
    });
    this.result = new ResultDialog({
      onShare: () => this.shareToX(),
      onSave: () => this.saveMedia(),
      onContinue: () => this.ready(),
    });
    this.pauseMenu = new PauseMenu({
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onReset: () => this.ready(),
      onQuit: () => this.finish(true),
    });
    this.input = new StageInput(this.canvas, {
      canStrike: () => this.phase === Phase.PLAYING,
      onAim: (x, y) => this.session.tool.aim(...this.camera.toWorld(x, y)),
      onLeave: () => this.session.tool.withdraw(),
      onCharge: (x, y) => this.charge(this.camera.toWorld(x, y)),
      onKeyCharge: () => this.charge(this.session.randomTarget()),
      onRelease: () => this.session.tool.release(),
      onCancel: () => this.session.tool.cancel(),
    });
    this.rack = new ToolRack(ARSENAL, { onSelect: (key) => this.selectTool(key) });
    this.selectTool(ARSENAL[0].key);
    this.bindChrome();
    new ResizeObserver(() => this.resize()).observe(this.wrap);
    this.resize();
    this.useSample(DEFAULT_SAMPLE);
    loadFonts().then(() => {
      if (this.phase === Phase.SETUP && this.subject && this.subject.sampleKey) this.useSample(this.subject.sampleKey);
    });
    this.recorder.probe();
    this.sound.listen((name, args) => this.recorder.cue(name, args));
    requestAnimationFrame((time) => this.frame(time));
  }

  selectTool(key) {
    this.toolKey = key;
    this.rack.select(key);
    if (this.session) this.session.equip(key);
  }

  bindChrome() {
    this.pauseButton.addEventListener('click', () => this.pause());
    const soundButton = byId('soundButton');
    soundButton.addEventListener('click', () => {
      this.sound.on = !this.sound.on;
      soundButton.setAttribute('aria-pressed', String(this.sound.on));
      if (this.sound.on) this.sound.unlock();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === PAUSE_KEY) this.togglePause();
      if (event.target.tagName === 'INPUT' || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = this.rack.toolFor(event.key);
      if (key) this.selectTool(key);
    });
  }

  resize() {
    const bounds = this.wrap.getBoundingClientRect();
    this.viewWidth = Math.max(1, bounds.width);
    this.viewHeight = Math.max(1, bounds.height);
    this.renderer.resize(this.viewWidth, this.viewHeight, pixelRatio());
    const room = this.session ? this.session.room : Room.fitting(PLACEHOLDER_METERS, PLACEHOLDER_METERS);
    this.camera.frame(this.viewWidth, this.viewHeight, room);
    this.renderer.stage(this.camera, room, this.session ? this.session.debris.resting : []);
  }

  useSample(key) {
    const sample = SAMPLES[key];
    this.useImage(sample.draw(), sample.name, key);
  }

  useImage(source, name, sampleKey) {
    this.subject = { source, name, sampleKey, thumb: coverThumbnail(source, THUMB_SIZE) };
    this.status.name = name;
    this.ready();
  }

  ready() {
    this.setup.present(this.subject.thumb, this.subject.sampleKey);
    this.prepare(this.materialKey);
  }

  byUser(action) {
    return (...args) => {
      this.sound.unlock();
      action(...args);
    };
  }

  prepare(materialKey) {
    this.materialKey = materialKey;
    this.reset();
    const material = MATERIALS[materialKey];
    const specimen = Specimen.create(this.subject.source, material);
    const room = Room.fitting(specimen.widthMeters, specimen.heightMeters);
    this.session = new Session({ specimen, material, room, sound: this.sound, tool: this.toolKey, onEngage: () => this.engage() });
    this.carry = 0;
    this.resize();
    this.status.material = material.label;
    this.setup.select(materialKey);
  }

  start() {
    if (this.phase !== Phase.SETUP || !this.session) return;
    this.sound.unlock();
    this.setup.hide();
    this.enter(Phase.PLAYING);
    this.canvas.focus({ preventScroll: true });
  }

  restart() {
    this.prepare(this.materialKey);
    this.start();
  }

  reset() {
    this.input.cancel();
    this.recorder.cancel();
    this.result.close();
    this.pauseMenu.close();
    if (this.session) this.session.dispose();
    this.session = null;
    this.shareFile = null;
    this.enter(Phase.SETUP);
    this.status.show(0, 0, 0, true);
  }

  enter(phase) {
    this.phase = phase;
    this.pauseButton.disabled = !PAUSABLE.has(phase);
  }

  togglePause() {
    if (this.phase === Phase.PLAYING) this.pause();
    else if (this.phase === Phase.PAUSED) this.resume();
  }

  pause() {
    if (this.phase !== Phase.PLAYING) return;
    this.input.cancel();
    this.enter(Phase.PAUSED);
    this.pauseMenu.present(this.session.started);
  }

  resume() {
    if (this.phase !== Phase.PAUSED) return;
    this.pauseMenu.close();
    this.enter(Phase.PLAYING);
    this.canvas.focus({ preventScroll: true });
  }

  charge(point) {
    if (!point) return;
    const { tool } = this.session;
    tool.aim(...point);
    tool.windUp();
    this.engage();
  }

  engage() {
    this.sound.unlock();
    if (this.session.started) return;
    this.session.start();
    this.startRecording();
  }

  startRecording() {
    this.recorder.begin(VIEW.frameAspect);
  }

  composeField(context, width, height) {
    const { x, y, width: fieldWidth, height: fieldHeight } = this.camera.field;
    const { dpr } = this.renderer;
    const field = { x: x * dpr, y: y * dpr, width: fieldWidth * dpr, height: fieldHeight * dpr };
    composeFrame(context, width, height, this.canvas, field, this.session.destruction);
  }

  frame(timestamp) {
    const now = timestamp / 1000;
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    try {
      this.tick(dt, now);
    } catch (error) {
      console.error(error);
    }
    requestAnimationFrame((time) => this.frame(time));
  }

  tick(dt, now) {
    const { session } = this;
    if (FROZEN.has(this.phase)) {
      this.draw();
      return;
    }
    if (session && this.filming) this.film(dt);
    else this.play(dt);
    if (!session) return;
    this.watchCompletion(now);
    this.status.show(session.destruction, session.elapsed, now);
  }

  get filming() {
    const { session } = this;
    return this.recorder.recording && session.started && session.isBusy(RECORDING.busyGrace);
  }

  get shotGap() {
    return this.filming ? this.recorder.lead * this.session.tempo : Infinity;
  }

  play(dt) {
    this.advance(dt + this.carry);
    this.carry = 0;
    this.draw();
  }

  film(dt) {
    if (this.recorder.saturated) return;
    this.carry += dt;
    if (this.shoot()) return;
    this.recorder.elapse(this.carry / this.session.tempo);
    this.play(0);
  }

  shoot() {
    let shot = false;
    for (let gap = this.shotGap; gap <= this.carry; gap = this.shotGap) {
      this.recorder.elapse(gap / this.session.tempo);
      this.advance(gap);
      this.carry -= gap;
      this.draw();
      this.recorder.capture((context, width, height) => this.composeField(context, width, height));
      shot = true;
    }
    return shot;
  }

  advance(dt) {
    const { session } = this;
    if (session) {
      session.update(dt);
      const shock = session.takeShock();
      if (shock) this.camera.impact(shock);
      this.camera.brace(session.focus);
      if (session.debris.takeStirred()) this.renderer.restock(this.camera, session.debris.resting);
      this.renderer.bake(this.camera, session.debris.takeSettled());
    }
    this.camera.update(dt, prefersReducedMotion());
  }

  draw() {
    this.renderer.render({ camera: this.camera, session: this.session });
  }

  watchCompletion(now) {
    const { session } = this;
    if (this.phase === Phase.PLAYING && session.started && session.demolished && !this.input.holding && !session.pending) {
      this.enter(Phase.SETTLING);
      this.settleStart = now;
      this.input.cancel();
      session.end();
    }
    if (this.phase !== Phase.SETTLING) return;
    const waited = now - this.settleStart;
    if ((session.isQuiet() && waited > COMPLETION.settleDelay) || waited > COMPLETION.settleTimeout) this.finish(false);
  }

  async finish(early) {
    const { session } = this;
    if (!session || !session.started || this.phase === Phase.DONE) return;
    this.enter(Phase.DONE);
    this.pauseMenu.close();
    this.input.cancel();
    session.end();
    const report = buildReport({ session, name: this.status.name, early });
    this.report = report;
    await loadFonts(report.fields.name + report.verdict + report.fields.date, REPORT_FONT_TIMEOUT);
    if (this.session !== session) return;
    const seal = makeSeal(early);
    this.result.present(report, seal, () => this.sound.stamp());
    this.result.showPoster(this.still());
    const outro = (context, width, height, time) => paintOutro(context, width, height, time, report, seal);
    const recording = await this.recorder.finish(outro, OUTRO_CUES, (fraction) => this.result.showProgress(fraction));
    if (this.session !== session) return;
    if (recording) this.result.showPreview(recording.preview);
    const video = recording && (await recording.final);
    if (this.session !== session) return;
    const name = `${FILE_PREFIX}${fileSafe(report.fields.name)}`;
    const poster = video ? this.recorder.canvas : this.still(outro);
    this.shareFile = video ? new File([video], `${name}.mp4`, { type: 'video/mp4' }) : await pngFile(poster, `${name}.png`);
    if (this.session !== session) return;
    this.result.showPoster(poster);
    this.result.showMedia(this.shareFile);
  }

  still(outro) {
    const { width, height } = frameSize(VIEW.frameAspect);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    this.composeField(context, width, height);
    if (outro) outro(context, width, height, RECORDING.outroSeconds);
    return canvas;
  }

  async shareToX() {
    if (!this.shareFile) return;
    const outcome = await this.shareKit.post(this.shareFile, shareText(this.report));
    this.result.showNote(SHARE_NOTES[outcome]);
  }

  saveMedia() {
    if (!this.shareFile) return;
    this.shareKit.save(this.shareFile);
    this.result.showNote('');
  }
}
