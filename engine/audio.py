"""Video Fabrikası — müzik ve efekt sentezi (telifsiz, her videoda farklı).
Kullanım: python3 audio.py cues.json out.wav
"""
import json, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
cfg = json.load(open(sys.argv[1]))
DUR = float(cfg["duration"])
rng = np.random.default_rng(int(cfg.get("seed", 1)) * 7919 + 13)
N = int(DUR * SR) + SR
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def env(n, a=0.005, d=0.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4) * curve / 4)
    return e


def add(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    sig = sig[: len(buf) - i]
    l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    buf[i : i + len(sig), 0] += sig * gain * l * 1.41
    buf[i : i + len(sig), 1] += sig * gain * r * 1.41


def tone(freq, dur, harm=(1, 0.3, 0.1), a=0.005, d=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(h * np.sin(2 * np.pi * freq * (k + 1) * t) for k, h in enumerate(harm))
    return s * env(n, a, d)


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------- efektler ----------
def fx_whoosh(dur=0.45, up=True):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    out = np.zeros(n)
    freqs = np.linspace(400, 4000, 8) if up else np.linspace(4000, 400, 8)
    seg = n // 8
    for k, f in enumerate(freqs):
        s = slice(k * seg, (k + 1) * seg if k < 7 else n)
        out[s] = bp(noise, f * 0.6, min(f * 1.4, 20000))[s]
    shape = np.sin(np.pi * t) ** 1.5
    return out * shape * 0.6


def fx_pop():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t * 25) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.05) * 0.7


def fx_tick():
    n = int(0.05 * SR)
    return hp(rng.standard_normal(n), 3000) * env(n, 0.0005, 0.012) * 0.8 + tone(2400, 0.05, (1,), 0.0005, 0.02) * 0.3


def fx_tock():
    return tone(1100, 0.08, (1, 0.2), 0.0005, 0.03) * 0.6


def fx_ding():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    base = 1318.5
    parts = [(1, 1, 1.2), (2.0, 0.4, 0.8), (2.76, 0.25, 0.5), (5.4, 0.1, 0.3)]
    s = sum(a * np.sin(2 * np.pi * base * m * t) * np.exp(-t / d) for m, a, d in parts)
    s2 = sum(a * np.sin(2 * np.pi * base * 1.5 * m * t) * np.exp(-t / d) for m, a, d in parts)
    s2 = np.concatenate([np.zeros(int(0.09 * SR)), s2[: n - int(0.09 * SR)]])
    return (s + s2 * 0.8) * 0.35


def fx_hit():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 8) + 38
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    crack = lp(rng.standard_normal(n), 2500) * np.exp(-t * 30) * 0.5
    return np.tanh((boom + crack) * 1.6) * 0.8


def fx_riser(dur=1.4):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    for k in range(10):
        s = slice(k * n // 10, (k + 1) * n // 10)
        f = 300 + 5000 * (k / 9) ** 2
        out[s] = bp(noise, f * 0.7, f * 1.3)[s]
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 900 * t ** 2) / SR) * 0.25
    return (out * 0.6 + sweep) * t ** 2 * 0.7


def fx_type():
    n = int(0.04 * SR)
    return bp(rng.standard_normal(n), 1500, 6000) * env(n, 0.0005, 0.01) * 0.35


def fx_cash():
    a = tone(2093, 0.5, (1, 0.5, 0.2), 0.001, 0.25)
    b = tone(2637, 0.6, (1, 0.5, 0.2), 0.001, 0.3)
    n = int(0.25 * SR)
    shake = hp(rng.standard_normal(n), 5000) * env(n, 0.002, 0.08) * 0.4
    out = np.zeros(int(0.8 * SR))
    out[: len(shake)] += shake
    out[: len(a)] += a * 0.4
    o = int(0.08 * SR)
    out[o : o + len(b)] += b[: len(out) - o] * 0.4
    return out


def fx_buzz():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return lp(np.sign(np.sin(2 * np.pi * 110 * t)), 1500) * env(n, 0.003, 0.25) * 0.35


def fx_thud():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 10) + 45) / SR) * np.exp(-t * 12) * 0.9


def fx_glitch():
    n = int(0.25 * SR)
    s = np.sign(rng.standard_normal(n // 200)).repeat(200)[:n]
    s = np.pad(s, (0, n - len(s)))
    return hp(s, 800) * env(n, 0.001, 0.2) * 0.25


def fx_mumble():
    # "mmm!" ağzı bağlı ses
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 180 + 40 * np.sin(2 * np.pi * 7 * t) + rng.uniform(-20, 20)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    s = lp(np.tanh(s * 3), 700)
    return s * np.sin(np.pi * t / t[-1]) ** 0.7 * 0.5


FX = dict(whoosh=fx_whoosh, whoosh_down=lambda: fx_whoosh(0.4, False), pop=fx_pop, tick=fx_tick, tock=fx_tock,
          ding=fx_ding, hit=fx_hit, riser=fx_riser, type=fx_type, cash=fx_cash, buzz=fx_buzz, thud=fx_thud,
          glitch=fx_glitch, mumble=fx_mumble)
FX_GAIN = dict(whoosh=0.45, whoosh_down=0.4, pop=0.5, tick=0.5, tock=0.45, ding=0.6, hit=0.75, riser=0.45, type=0.6,
               cash=0.6, buzz=0.5, thud=0.6, glitch=0.5, mumble=0.6)


# ---------- müzik ----------
def drum_kit(style):
    kick = lambda: fx_thud() * 1.1
    def snare():
        n = int(0.22 * SR)
        return (bp(rng.standard_normal(n), 1200, 7000) * env(n, 0.001, 0.09) * 0.5 + tone(190, 0.22, (1,), 0.001, 0.06)[:n] * 0.4)
    def hat(open_=False):
        n = int((0.18 if open_ else 0.05) * SR)
        return hp(rng.standard_normal(n), 7000) * env(n, 0.0005, 0.06 if open_ else 0.015) * 0.3
    return kick, snare, hat


def music_lofi(m):
    bpm = m.get("bpm") or rng.integers(78, 96)
    beat = 60 / bpm
    root = 57 + int(rng.integers(-3, 4))
    progs = [[0, 5, 3, 4], [0, 9, 5, 7], [2, 7, 0, 5], [0, 4, 9, 5], [5, 4, 0, 9]]
    prog = progs[rng.integers(len(progs))]
    chord_shapes = {0: [0, 4, 7, 11], 2: [2, 5, 9, 12], 3: [3, 7, 10, 14], 4: [4, 7, 11, 14], 5: [5, 9, 12, 16], 7: [7, 11, 14, 17], 9: [9, 12, 16, 19]}
    kick, snare, hat = drum_kit("lofi")
    swing = rng.uniform(0.02, 0.06)
    bar = 4 * beat
    t, i = 0.0, 0
    while t < DUR + bar:
        notes = chord_shapes[prog[i % 4]]
        for k, n in enumerate(notes):
            add(music, t + k * 0.012, lp(tone(mtof(root + n), bar * 1.1, (1, 0.35, 0.12, 0.05), 0.01, bar * 0.9), 2200), 0.13, (k - 1.5) * 0.2)
        add(music, t, lp(tone(mtof(root + prog[i % 4] - 24), bar, (1, 0.2), 0.01, bar * 0.8), 300), 0.35)
        for b in range(4):
            bt = t + b * beat
            if b in (0, 2) or (b == 3 and rng.random() < 0.3):
                add(music, bt, kick(), 0.55)
            if b in (1, 3):
                add(music, bt, snare(), 0.35)
            for e in range(2):
                add(music, bt + e * beat / 2 + (swing if e else 0), hat(), 0.5 if e == 0 else 0.3, 0.3)
        # melodi kırıntısı
        if rng.random() < 0.6:
            for k in range(int(rng.integers(2, 5))):
                nn = root + 12 + [0, 2, 4, 7, 9, 12][rng.integers(6)] + prog[i % 4] % 2
                add(music, t + rng.integers(0, 8) * beat / 2, lp(tone(mtof(nn), 0.5, (1, 0.1), 0.004, 0.25), 3000), 0.09, rng.uniform(-0.5, 0.5))
        t += bar
        i += 1
    # vinil cızırtı
    crackle = np.zeros(N)
    idx = rng.integers(0, N, int(DUR * 25))
    crackle[idx] = rng.uniform(-1, 1, len(idx))
    music[:, 0] += lp(crackle, 4000) * 0.15
    music[:, 1] += lp(np.roll(crackle, 300), 4000) * 0.15
    music[:] = np.column_stack([lp(music[:, 0], 6000), lp(music[:, 1], 6000)])


def music_tension(m):
    bpm = m.get("bpm") or rng.integers(96, 116)
    beat = 60 / bpm
    root = 45 + int(rng.integers(-2, 4))
    scale = [0, 2, 3, 5, 7, 8, 11]
    kick, snare, hat = drum_kit("tension")
    patterns = [[0, 0, 7, 0, 3, 0, 7, 5], [0, 3, 0, 7, 0, 8, 7, 3], [0, 0, 3, 5, 0, 0, 8, 7], [0, 7, 3, 7, 0, 8, 5, 3]]
    pat = patterns[rng.integers(len(patterns))]
    pluck_mode = rng.random() < 0.5  # pizzicato "sinsi" his
    t, step = 0.0, 0
    # drone
    n = N
    tt = np.arange(n) / SR
    drone = (np.sin(2 * np.pi * mtof(root - 12) * tt) + 0.5 * np.sin(2 * np.pi * mtof(root - 5) * tt * 1.002)) * 0.08
    drone *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.1 * tt)
    music[:, 0] += lp(drone, 500)
    music[:, 1] += lp(np.roll(drone, 200), 500)
    while t < DUR + 1:
        note = root + pat[step % 8]
        if pluck_mode:
            sig = tone(mtof(note + 12), 0.3, (1, 0.5, 0.25, 0.1), 0.001, 0.12)
            add(music, t, lp(sig, 2500), 0.22, 0.25 if step % 2 else -0.25)
        else:
            sig = np.tanh(tone(mtof(note), beat / 2 * 0.95, (1, 0.6, 0.4, 0.2), 0.003, beat * 0.4) * 2)
            add(music, t, lp(sig, 900), 0.2)
        if step % 4 == 0:
            add(music, t, kick(), 0.5)
        if step % 8 == 4 and rng.random() < 0.8:
            add(music, t, snare(), 0.25)
        add(music, t, hat(), 0.25 if step % 2 else 0.12, 0.4)
        t += beat / 2
        step += 1


def music_none(m):
    pass


STYLES = dict(lofi=music_lofi, tension=music_tension, none=music_none)
mcfg = cfg.get("music") or {"style": "lofi"}
STYLES.get(mcfg.get("style", "lofi"), music_lofi)(mcfg)

for c in cfg["cues"]:
    typ = c["type"]
    if typ not in FX:
        continue
    sig = FX[typ]()
    t = c["t"]
    if typ == "riser":
        t -= len(sig) / SR
    add(sfx, t, sig, FX_GAIN[typ] * c.get("gain", 1.0), c.get("pan", rng.uniform(-0.3, 0.3)))

# müzik efekt anında hafif kısılsın (ducking)
duck = np.ones(N)
for c in cfg["cues"]:
    if c["type"] in ("hit", "ding", "cash"):
        i = int(c["t"] * SR)
        L = int(0.6 * SR)
        seg = 1 - 0.45 * np.exp(-np.arange(L) / (0.25 * SR))
        duck[i : i + L] = np.minimum(duck[i : i + L], seg[: max(0, min(L, N - i))])
mix = music * float(mcfg.get("gain", 0.55)) * duck[:, None] + sfx
n_out = int(DUR * SR)
mix = mix[:n_out]
fade = int(0.4 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
mix = np.tanh(mix * 1.1)
mix /= max(1e-6, np.abs(mix).max()) / 0.89
wavfile.write(sys.argv[2], SR, (mix * 32767).astype(np.int16))
