import { useState } from 'react'
import {
  Gallery,
  transitionDefaultDuration,
  type SlideDirection,
  type ThemeSetting,
  type TileEffect,
  type TileOrder,
  type TransitionKind,
  type TransitionSetting,
} from 'lightbox'
import 'lightbox/styles.css'
import './demo.css'
import { cityAndArchitecture, landscapes } from './images'

type DemoLocale = 'en' | 'ja'

const copy: Record<DemoLocale, Record<string, string>> = {
  en: {
    heading: 'Lightbox demo',
    intro: 'Two independent galleries on one page. Try the theme, language and transition controls, then click a thumbnail.',
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeAuto: 'Auto',
    transition: 'Transition',
    pop: 'Pop',
    fade: 'Fade',
    slide: 'Slide',
    draw: 'Draw',
    spin: 'Spin',
    roll: 'Roll',
    duration: 'Duration',
    cols: 'Columns',
    rows: 'Rows',
    tileEffect: 'Tile effect',
    tileOrder: 'Tile order',
    orderRandom: 'Random',
    orderSequential: 'Top-left to bottom-right',
    orderSnake: 'Snake',
    orderDiagonal: 'Diagonal',
    slideFrom: 'Slide in from',
    slideTo: 'Slide out to',
    top: 'Top',
    bottom: 'Bottom',
    left: 'Left',
    right: 'Right',
    topLeft: 'Top-left',
    topRight: 'Top-right',
    bottomLeft: 'Bottom-left',
    bottomRight: 'Bottom-right',
    random: 'Random',
    gallery1: 'Landscapes',
    gallery2: 'City & architecture',
    vanillaLink: 'Vanilla demo (no React) →',
  },
  ja: {
    heading: 'ライトボックス デモ',
    intro: '1ページに独立した2つのギャラリー。テーマ・言語・トランジションを切り替えて、サムネイルをクリックしてください。',
    language: '言語',
    theme: 'テーマ',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    themeAuto: '自動',
    transition: 'トランジション',
    pop: 'ポップ',
    fade: 'フェード',
    slide: 'スライド',
    draw: 'ドロー',
    spin: 'スピン',
    roll: 'ロール',
    duration: '時間',
    cols: '列数',
    rows: '行数',
    tileEffect: 'タイル効果',
    tileOrder: 'タイル順序',
    orderRandom: 'ランダム',
    orderSequential: '左上から右下へ',
    orderSnake: '蛇行',
    orderDiagonal: '対角線',
    slideFrom: 'イン方向',
    slideTo: 'アウト方向',
    top: '上',
    bottom: '下',
    left: '左',
    right: '右',
    topLeft: '左上',
    topRight: '右上',
    bottomLeft: '左下',
    bottomRight: '右下',
    random: 'ランダム',
    gallery1: '風景',
    gallery2: '街と建築',
    vanillaLink: 'バニラ版デモ（React不使用）→',
  },
}

export default function DemoApp() {
  const [locale, setLocale] = useState<DemoLocale>('en')
  const [theme, setTheme] = useState<ThemeSetting>('auto')
  const [kind, setKind] = useState<TransitionKind>('pop')
  const [duration, setDuration] = useState(transitionDefaultDuration.pop)
  const [cols, setCols] = useState(5)
  const [rows, setRows] = useState(4)
  const [tileEffect, setTileEffect] = useState<TileEffect>('fade')
  const [tileOrder, setTileOrder] = useState<TileOrder>('random')
  const [slideFrom, setSlideFrom] = useState<SlideDirection>('top')
  const [slideTo, setSlideTo] = useState<SlideDirection>('bottom')
  const t = copy[locale]
  const showSlideDirections =
    kind === 'slide' ||
    kind === 'spin' ||
    kind === 'roll' ||
    (kind === 'draw' && (tileEffect === 'slide' || tileEffect === 'spin'))
  // roll ignores slideTo: it always rolls back up towards its entry edge
  const showSlideTo = showSlideDirections && kind !== 'roll'

  const changeKind = (next: TransitionKind) => {
    setKind(next)
    setDuration(transitionDefaultDuration[next])
    // roll only unrolls from a straight edge; snap a selected corner to one
    if (next === 'roll' && slideFrom.includes('-')) {
      setSlideFrom(slideFrom.startsWith('top') ? 'top' : 'bottom')
    }
  }

  const transition: TransitionSetting = {
    kind,
    duration,
    cols,
    rows,
    tileEffect,
    tileOrder,
    slideFrom,
    slideTo,
  }

  return (
    <div className="demo" data-theme={theme}>
      <main className="demo-main">
        <h1>{t.heading}</h1>
        <p className="demo-intro">
          {t.intro} <a href="/vanilla">{t.vanillaLink}</a>
        </p>

        <div className="demo-controls">
          <label>
            {t.language}
            <select value={locale} onChange={(e) => setLocale(e.target.value as DemoLocale)}>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
          <label>
            {t.theme}
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeSetting)}>
              <option value="auto">{t.themeAuto}</option>
              <option value="light">{t.themeLight}</option>
              <option value="dark">{t.themeDark}</option>
            </select>
          </label>
          <label>
            {t.transition}
            <select value={kind} onChange={(e) => changeKind(e.target.value as TransitionKind)}>
              <option value="pop">{t.pop}</option>
              <option value="fade">{t.fade}</option>
              <option value="slide">{t.slide}</option>
              <option value="draw">{t.draw}</option>
              <option value="spin">{t.spin}</option>
              <option value="roll">{t.roll}</option>
            </select>
          </label>
          <label>
            {t.duration}
            <input
              type="range"
              min={100}
              max={3000}
              step={20}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
            <span className="demo-value">{duration}ms</span>
          </label>
          {kind === 'draw' && (
            <>
              <label>
                {t.tileEffect}
                <select
                  value={tileEffect}
                  onChange={(e) => setTileEffect(e.target.value as TileEffect)}
                >
                  <option value="fade">{t.fade}</option>
                  <option value="pop">{t.pop}</option>
                  <option value="slide">{t.slide}</option>
                  <option value="spin">{t.spin}</option>
                </select>
              </label>
              <label>
                {t.tileOrder}
                <select
                  value={tileOrder}
                  onChange={(e) => setTileOrder(e.target.value as TileOrder)}
                >
                  <option value="random">{t.orderRandom}</option>
                  <option value="sequential">{t.orderSequential}</option>
                  <option value="snake">{t.orderSnake}</option>
                  <option value="diagonal">{t.orderDiagonal}</option>
                </select>
              </label>
              <label>
                {t.cols}
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label>
                {t.rows}
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </>
          )}
          {showSlideDirections && (
            <>
              <label>
                {t.slideFrom}
                <select
                  value={slideFrom}
                  onChange={(e) => setSlideFrom(e.target.value as SlideDirection)}
                >
                  <option value="top">{t.top}</option>
                  <option value="bottom">{t.bottom}</option>
                  <option value="left">{t.left}</option>
                  <option value="right">{t.right}</option>
                  {kind !== 'roll' && (
                    <>
                      <option value="top-left">{t.topLeft}</option>
                      <option value="top-right">{t.topRight}</option>
                      <option value="bottom-left">{t.bottomLeft}</option>
                      <option value="bottom-right">{t.bottomRight}</option>
                    </>
                  )}
                  <option value="random">{t.random}</option>
                </select>
              </label>
              {showSlideTo && (
              <label>
                {t.slideTo}
                <select
                  value={slideTo}
                  onChange={(e) => setSlideTo(e.target.value as SlideDirection)}
                >
                  <option value="top">{t.top}</option>
                  <option value="bottom">{t.bottom}</option>
                  <option value="left">{t.left}</option>
                  <option value="right">{t.right}</option>
                  <option value="top-left">{t.topLeft}</option>
                  <option value="top-right">{t.topRight}</option>
                  <option value="bottom-left">{t.bottomLeft}</option>
                  <option value="bottom-right">{t.bottomRight}</option>
                  <option value="random">{t.random}</option>
                </select>
              </label>
              )}
            </>
          )}
        </div>

        <h2>{t.gallery1}</h2>
        <Gallery images={landscapes} locale={locale} theme={theme} transition={transition} />

        <h2>{t.gallery2}</h2>
        <Gallery
          images={cityAndArchitecture}
          locale={locale}
          theme={theme}
          transition={transition}
        />
      </main>
    </div>
  )
}
