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
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { Renderer } from '../render/Renderer.js';
import { buildReport, shareText } from '../report/Report.js';
import { STAMP_DELAY, makeSeal, paintOutro } from '../report/ReportCard.js';
import { SAMPLES } from '../samples/samples.js';
import { Camera, Room } from '../scene/Camera.js';
import { Session } from '../scene/Session.js';
import { byId, markSelected, tileButton } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { ImageIntake } from '../ui/ImageIntake.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { ResultDialog } from '../ui/ResultDialog.js';
import { SetupPanel } from '../ui/SetupPanel.js';
import { StageInput } from '../ui/StageInput.js';
import { StatusBar } from '../ui/StatusBar.js';
import { Toast } from '../ui/Toast.js';

const MAX_FRAME_SECONDS = 0.05;
const THUMB_SIZE = 220;
const PLACEHOLDER_METERS = 0.6;
const DEFAULT_SAMPLE = 'monday';
const DEFAULT_MATERIAL = 'glass';
const REPORT_FONT_TIMEOUT = 1500;
const FILE_PREFIX = '와장창_';
const PAUSE_KEY = 'Escape';
const OUTRO_CUES = [{ name: 'stamp', offset: STAMP_DELAY / 1000 }];
const TOOLS = [
  { key: 'hammer', label: '망치', icon: ICONS.hammer, shortcut: '1' },
  { key: 'bomb', label: '폭탄', icon: ICONS.bomb, shortcut: '2' },
  { key: 'saw', label: '톱날', icon: ICONS.saw, shortcut: '3' },
  { key: 'katana', label: '참격', icon: ICONS.katana, shortcut: '4' },
  { key: 'press', label: '프레스', icon: ICONS.press, shortcut: '5' },
  { key: 'flame', label: '화염', icon: ICONS.flame, shortcut: '6' },
];

const Phase = Object.freeze({ SETUP: 'setup', PLAYING: 'playing', PAUSED: 'paused', SETTLING: 'settling', DONE: 'done' });
const PAUSABLE = new Set([Phase.PLAYING, Phase.PAUSED]);

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
  static async launch() {
    await PhysicsWorld.load();
    return new App();
  }

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
    this.buildRack();
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

  buildRack() {
    this.tools = TOOLS.map((tool) => tileButton(tool));
    byId('rack').append(...this.tools);
    this.tools.forEach((button) => button.addEventListener('click', () => this.selectTool(button.dataset.key)));
    this.selectTool(TOOLS[0].key);
  }

  selectTool(key) {
    this.toolKey = key;
    markSelected(this.tools, 'aria-pressed', key);
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
      const tool = TOOLS.find((entry) => entry.shortcut === event.key);
      if (tool) this.selectTool(tool.key);
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
    if (this.phase === Phase.PAUSED) {
      this.renderer.render({ camera: this.camera, session });
      return;
    }
    if (session) {
      session.update(dt);
      const shock = session.takeShock();
      if (shock) this.camera.impact(shock);
      this.camera.brace(session.focus);
      if (session.debris.takeStirred()) this.renderer.restock(this.camera, session.debris.resting);
      this.renderer.bake(this.camera, session.debris.takeSettled());
    }
    this.camera.update(dt, prefersReducedMotion());
    this.renderer.render({ camera: this.camera, session });
    if (!session) return;
    this.watchCompletion(now);
    if (session.started && session.isBusy(RECORDING.busyGrace)) {
      this.recorder.capture(dt / session.tempo, (context, width, height) => this.composeField(context, width, height));
    }
    this.status.show(session.destruction, session.elapsed, now);
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
