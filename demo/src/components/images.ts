import type { GalleryImage, ImageSource } from 'lightbox/core'

/** Build a 3:2 srcset from picsum.photos at three widths. */
const pic = (id: number): ImageSource[] =>
  [480, 960, 1920].map((w) => ({
    src: `https://picsum.photos/id/${id}/${w}/${Math.round((w * 2) / 3)}`,
    width: w,
  }))

const img = (
  id: number,
  title: { en: string; ja: string },
  description: { en: string; ja: string },
): GalleryImage => ({
  id: String(id),
  sources: pic(id),
  width: 1920,
  height: 1280,
  title,
  description,
  alt: title,
})

export const landscapes: GalleryImage[] = [
  img(
    1015,
    { en: 'River valley', ja: '渓谷の川' },
    {
      en: 'A river winding through a forested valley in the early morning.',
      ja: '早朝、森に囲まれた谷を蛇行して流れる川。',
    },
  ),
  img(
    1016,
    { en: 'Canyon walls', ja: '峡谷の岩壁' },
    {
      en: 'Layered rock formations carved over thousands of years.',
      ja: '何千年もかけて刻まれた層状の岩壁。',
    },
  ),
  img(
    1018,
    { en: 'Highland mist', ja: '高原の霧' },
    {
      en: 'Low cloud drifting across the high ground at dawn.',
      ja: '夜明けの高地を漂う低い雲。',
    },
  ),
  img(
    1036,
    { en: 'Snow line', ja: '雪の稜線' },
    {
      en: 'The first snow of the season on the upper slopes.',
      ja: '上部斜面に降りた今シーズン初めての雪。',
    },
  ),
  img(
    1039,
    { en: 'Waterfall', ja: '滝' },
    {
      en: 'Meltwater dropping through a narrow gorge.',
      ja: '狭い峡谷を流れ落ちる雪解け水。',
    },
  ),
  img(
    1043,
    { en: 'Evening light', ja: '夕暮れの光' },
    {
      en: 'The last light of the day over open country.',
      ja: '開けた土地に差す一日の最後の光。',
    },
  ),
]

export const cityAndArchitecture: GalleryImage[] = [
  img(
    1040,
    { en: 'Old castle', ja: '古城' },
    {
      en: 'Stone walls that have watched over the valley for centuries.',
      ja: '何世紀にもわたって谷を見守ってきた石壁。',
    },
  ),
  img(
    1047,
    { en: 'City at night', ja: '夜の街' },
    {
      en: 'Rooftops and streetlights after the rain.',
      ja: '雨上がりの屋根と街灯。',
    },
  ),
  img(
    1067,
    { en: 'Quiet street', ja: '静かな通り' },
    {
      en: 'A narrow lane in the old quarter, just after sunrise.',
      ja: '日の出直後の旧市街の細い路地。',
    },
  ),
  img(
    1076,
    { en: 'Concrete forms', ja: 'コンクリートの造形' },
    {
      en: 'Modern architecture reduced to simple geometry.',
      ja: 'シンプルな幾何学に還元された現代建築。',
    },
  ),
]
