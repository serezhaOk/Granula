# GRANULA — React Native (Expo)

Нативный порт веб-версии GRANULA (гранулярный эмбиент-синтезатор) на React
Native + Expo. Одна кодовая база → **iOS и Android**. Веб-версия (`../index.html`)
остаётся без изменений; эта папка самодостаточна.

## Что перенесено

| Веб (index.html) | Здесь |
|---|---|
| Web Audio API грейн-движок | `src/audio/engine.ts` через **react-native-audio-api** (те же узлы 1:1) |
| Look-ahead планировщик + транс-гейт | `src/audio/engine.ts` (та же логика на `ctx.currentTime`) |
| Микрофон (`MediaRecorder`) | `src/audio/useRecorder.ts` через **expo-audio** (запись + metering) |
| Canvas 2D `#fx` ASCII-частицы | `src/visuals/Particles.tsx` (**react-native-skia**, 1:1) |
| Canvas 2D `#recWave` осциллограф | `src/visuals/RecWave.tsx` (Skia, 1:1) |
| Canvas 2D `#startFx` стартовый glow | `src/visuals/StartGlow.tsx` (Skia, 1:1) |
| Мультитач морф-пад | `src/ui/MorphPad.tsx` (**react-native-gesture-handler**) |
| SVG-кнобы G/P/D/S | `src/ui/Knob.tsx` (Skia-дуга + вертикальный драг) |
| IndexedDB `samples` | `src/storage/library.ts` (**expo-sqlite** + файлы в documentDirectory) |
| `localStorage` (knobs, last, used-names) | `src/storage/prefs.ts` (таблица `prefs`) |
| `<input type=file>` | **expo-document-picker** (`controller.importFile`) |
| DM Mono woff2 | **@expo-google-fonts/dm-mono** (ttf) |

Вся DSP-математика (Hann-огибающая, гармонические интервалы, tide/chaos/halo,
шиммер, реверс-зёрна, свёрточный ревёрб) перенесена дословно из `index.html`.

## Архитектура

- `src/core/params.ts` — общие мутабельные параметры (KNOBS, morph, pointers),
  вне React, как глобалы веб-версии. Аудио-планировщик и рендер читают их напрямую.
- `src/core/controller.ts` — «мозг»: связывает движок, библиотеку, prefs; хранит
  срез состояния для React (`useSyncExternalStore` в `src/ui/useAppState.ts`).
- `src/core/tick.ts` — единый RAF-тик: сглаживание морфа + уровень с анализатора.
- Визуалы держат собственные RAF-циклы, рисуя `Skia.Picture` каждый кадр.

## Запуск

Требуется **dev-client** (нативные модули: audio-api, skia, reanimated) —
Expo Go не подойдёт.

```bash
cd native
npm install
npx expo install --fix        # выровнять версии под текущий Expo SDK
npx expo prebuild             # сгенерировать ios/ и android/
npx expo run:ios              # или: npx expo run:android
```

Для сборки без локального Mac и публикации в сторы:

```bash
npm i -g eas-cli
eas build --profile preview --platform all
eas submit --platform ios     # TestFlight
eas submit --platform android  # внутренний трек Play
```

## Проверка (нужно устройство)

1. Собрать dev-client, открыть на реальных iPhone и Android.
2. Тап «tap to start» → должен зазвучать встроенный pad (`genPad`); водить пальцем
   по экрану — облако зёрен должно менять характер по углам (Halo/Pulse/Tide/Chaos),
   без щелчков/дропаутов. Проверить Hann-огибающую и хвост ревёрба на слух.
3. Кнобы G/P/D/S — вертикальный драг меняет параметр, дуга и подпись обновляются,
   значения переживают перезапуск.
4. Запись с микрофона: REC → осциллограф реагирует на голос, Stop сохраняет сэмпл
   с авто-именем; ✕ отменяет. После записи громкий динамик восстанавливается (iOS).
5. Библиотека: загрузить mp3/wav через пикер, переименовать (✎), удалить (✕),
   выбрать встроенный Pad.

## Замечания по совместимости

- Имена узлов Web Audio в `react-native-audio-api` предполагаются веб-совместимыми
  (`createConvolver`, `createStereoPanner`, `decodeAudioData`, `copyToChannel`,
  `setValueCurveAtTime`). Если в установленной версии имя иное — правка точечная,
  движок изолирован в `src/audio/engine.ts`. `decodeAudioDataSource(uri)` берётся
  как fast-path с fallback на чтение байтов (`src/audio/loader.ts`).
- iOS аудио-сессия (`playback` / `play-and-record`) выставляется через
  `react-native-audio-api` AudioManager в `src/audio/session.ts` (защищённо, с
  no-op при отсутствии метода).
- Версии в `package.json` — ориентир под Expo SDK 52; `npx expo install --fix`
  приводит их к согласованному набору.

> Проект собран и вычитан статически; сборка под устройство и прогон на iOS/Android
> выполняются на машине с Xcode/Android SDK (или через EAS) — в CI-контейнере это
> не воспроизводится.
