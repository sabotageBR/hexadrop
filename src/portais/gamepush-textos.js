/**
 * Os textos que so o build da GamePush tem (src/portais/gamepush.js):
 *
 * - **o russo**, inteiro (interface, jogo e tutorial). A GamePush publica nas
 *   plataformas russas (Yandex Games, VK, OK), e o checklist dela pede o russo
 *   nelas. Os outros builds continuam com os sete idiomas de core/i18n.js: a
 *   tabela entra por `acrescentaTextos`, que so este build chama;
 * - **o rotulo dos botoes de video** nos oito idiomas (`comVideo`, `verVideo`):
 *   o checklist pede que o jogador saiba, pelo texto, que vai ver um anuncio.
 *
 * O russo usa "ты", como um jogo casual, e a mesma palavra do comeco ao fim:
 * уровень (fase), мир (mundo), шестиугольник (hexagono), блок (peca), монеты,
 * звёзды, ход (toque), цель (meta). Onde ha numero, o plural russo de verdade
 * (1 уровень, 2 уровня, 5 уровней) sai de `plural()`.
 *
 * Os gritos da vitoria sao desenhados no canvas com a Fredoka, que nao tem
 * cirilico: a GamePush poe a Nunito (cirilico, OFL) na mesma familia, so para
 * as letras cirilicas (`fonteCirilica` em gamepush.js).
 */

import { acrescentaTextos } from '../core/i18n.js';

/**
 * A forma do plural russo para n: 0 = um (1, 21, 101), 1 = poucos (2-4,
 * 22-24), 2 = muitos (0, 5-20, 25-30, 11-14).
 * @param {number} n
 * @returns {0|1|2}
 */
export function formaRussa(n) {
  const a = Math.abs(Math.trunc(n));
  const m10 = a % 10;
  const m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return 0;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
  return 2;
}

/**
 * Um texto com plural. O `t()` de core/i18n.js so chama `replace` no valor
 * quando ha argumentos, e o callback dele devolve cada `{n}` ja trocado: daqui
 * sai o numero de `{0}`, e com ele a forma certa. Sem argumentos (nunca
 * acontece nestas chaves) vale a forma de "muitos".
 * @param {string} um      1, 21, 101...
 * @param {string} poucos  2-4, 22-24...
 * @param {string} muitos  0, 5-20, 25-30...
 */
export function plural(um, poucos, muitos) {
  const formas = [um, poucos, muitos];
  return {
    /**
     * @param {RegExp} re
     * @param {(m: string, i: string) => string} troca
     * @returns {string}
     */
    replace(re, troca) {
      const n = Number(troca('{0}', '0'));
      const forma = Number.isFinite(n) ? formas[formaRussa(n)] : muitos;
      return forma.replace(re, troca);
    },
    toString() {
      return muitos;
    },
  };
}

/** O russo, com exatamente as chaves do ingles de core/i18n.js. */
export const RUSSO = {
  materialTnt: 'Динамит',
  hintTnt: 'Взрывается от любого сильного удара.',
  materialCrystal: 'Кристалл',
  hintCrystal: 'Трескается, если шестиугольник задержится на нём.',
  materialWax: 'Воск',
  hintWax: 'От тепла размягчается. Держит недолго.',
  newHazard: 'Новое препятствие',
  hazardSwing: 'Качающаяся платформа',
  hintSwing: 'Выбери правильный момент.',
  hazardWind: 'Ветер',
  hintWind: 'Порывы сдувают всё в сторону.',
  regraJoia: 'Спаси самоцвет',
  dicaJoia: 'Опусти шестиугольник вниз и не урони самоцвет.',
  motivoJoia: 'Самоцвет упал!',
  regraCadeado: 'Блоки с замком',
  dicaCadeado: 'Блоки с замком не разбиваются.',
  regraDourado: 'Золотая посадка',
  dicaDourado: 'Посади шестиугольник на золотую полосу.',
  motivoDourado: 'Мимо золота!',
  tutorialClick: 'Кликни по блоку, чтобы разбить его',
  skinOuro: '{0} (золото)',
  perfeitasMarco: plural('{0} идеальное прохождение', '{0} идеальных прохождения', '{0} идеальных прохождений'),
  perfeitasTitulo: 'Идеальные прохождения',
  gateNeed: plural('ещё {0} звезда, чтобы открыть', 'ещё {0} звезды, чтобы открыть', 'ещё {0} звёзд, чтобы открыть'),
  gateOpen: 'Открыт',
  gateLocked: 'Мир закрыт',
  shuffle: 'Перемешать уровень',
  shuffleNone: 'Перемешиваний не осталось',
  shuffleUsed: 'Новая расстановка',
  shuffleOnly: 'Здесь только одна расстановка',
  boosts: 'Бустеры',
  boostShuffle: 'Перемешать',
  boostShuffleDesc: 'Собирает уровень заново в другой проверенной расстановке.',
  owned_n: 'У тебя: {0}',
  play: 'Играть',
  levels: 'Уровни',
  level: 'Уровень',
  shop: 'Магазин',
  settings: 'Настройки',
  back: 'Назад',
  close: 'Закрыть',
  resume: 'Продолжить',
  restart: 'Заново',
  retry: 'Ещё раз',
  next: 'Дальше',
  home: 'Меню',
  quit: 'Выйти из уровня',
  victory: 'Победа',
  worldClear: 'Мир пройден',
  levelsCleared: plural('Пройден {0} уровень!', 'Пройдено {0} уровня!', 'Пройдено {0} уровней!'),
  skinClassic: 'Оригинал',
  skinEmber: 'Уголёк',
  skinMint: 'Мята',
  skinViolet: 'Фиалка',
  skinGold: 'Золото',
  skinCircuit: 'Микросхема',
  skinAurora: 'Аврора',
  skinShadow: 'Тень',
  skinSunny: 'Солнышко',
  skinStrawberry: 'Клубника',
  skinPinwheel: 'Вертушка',
  skinBubblegum: 'Жвачка',
  skinNightstar: 'Ночная звезда',
  skinPixelLeaf: 'Пиксельный лист',
  skinGrape: 'Виноград',
  skinGraphite: 'Графит',
  skinPixelEmber: 'Пиксельный уголёк',
  skinRosy: 'Розочка',
  skinTangerine: 'Мандарин',
  skinSunwheel: 'Солнечное колесо',
  skinLemondrop: 'Лимонный леденец',
  skinMintstripe: 'Мятная полоска',
  skinSmiley: 'Весельчак',
  skinShades: 'Крутой',
  skinGrumpy: 'Ворчун',
  skinRobot: 'Робот',
  skinSkully: 'Черепок',
  skinWatermelon: 'Арбуз',
  skinPizza: 'Пицца',
  skinCheese: 'Сыр',
  skinFriedEgg: 'Яичница',
  skinSoccer: 'Футбольный мяч',
  skinBasketball: 'Баскетбольный мяч',
  skinClock: 'Часы',
  skinGamepad: 'Геймпад',
  skinTartan: 'Шотландка',
  prizeSkin: 'Новый шестиугольник!',
  prizeUpgrade: 'Бесплатное улучшение!',
  prizeCoins: 'Сундук с монетами!',
  prizeOwned: 'Уже есть: +{0}',
  prizeWorld: 'Пройди мир {0}',
  prizeRefundAt: 'Монеты вернутся в мире {0}',
  prizeUpgradeNext: 'Бесплатно в мире {0}',
  prizeTeaser: 'Пройди мир, чтобы получить это',
  prizesRetro: 'Открыто призов за миры: {0}',
  prizeNext: 'Следующий приз',
  chuvaSeal: 'Дождь',
  gritoBoa: ['ЕСТЬ!', 'КЛАСС!', 'ХОРОШО!'],
  gritoOtima: ['ОТЛИЧНО!', 'СУПЕР!', 'ЗДОРОВО!'],
  gritoPerfeita: ['ИДЕАЛЬНО!', 'БЕЗУПРЕЧНО!'],
  upgLevelN: 'Уровень {0}',
  gameOver: 'Игра окончена',
  paused: 'Пауза',
  locked: 'Закрыто',
  // Vem depois de um numero ("200 монет" na loja, "0 монет" na bolsa da vitoria): o
  // genitivo plural, que e o certo para todo preco da loja (multiplos de 10).
  coins: 'монет',
  xp: 'Опыт',
  playerLevel: 'Ранг',
  tapToStart: 'Нажми на блок, чтобы начать',
  swipeWorlds: 'Листай, чтобы сменить мир',
  tutorialTap: 'Нажимай на блоки, чтобы разбить их',
  tutorialGoal: 'Опусти шестиугольник на платформу',
  tutorialStars: 'Пересекай пунктирные линии, чтобы получать звёзды',
  retryAutoTitle: 'Почти!',
  retryAuto: 'Ещё раз',
  skipTutorial: 'Пропустить',
  watchAd: 'Смотреть',
  doubleReward: 'Удвоить награду',
  dailyBonus: 'Ежедневный бонус',
  dailyBonusReady: 'Бесплатные монеты ждут',
  comeBackTomorrow: 'Возвращайся завтра',
  skipLevel: 'Пропустить уровень',
  skipNoStars: 'За пропущенный уровень звёзд не дают.',
  combo: 'Комбо',
  stuckTitle: 'Не получается?',
  bestStars: 'Лучший',
  taps: 'Ходы',
  par: 'Цель',
  newRecord: 'Новый рекорд',
  rewardCoins: 'Монеты',
  rewardXp: 'Опыт',
  skins: 'Скины',
  upgrades: 'Улучшения',
  equipped: 'Выбран',
  equip: 'Выбрать',
  buy: 'Купить',
  owned: 'Уже твой',
  unlockAt: 'Ранг {0}',
  notEnoughCoins: 'Недостаточно монет',
  maxLevel: 'Макс.',
  upgStability: 'Устойчивость',
  upgStabilityDesc: 'Шестиугольник меньше качается при посадке.',
  upgGrip: 'Сцепление',
  upgGripDesc: 'Шестиугольник меньше скользит по льду и склонам.',
  upgFortune: 'Удача',
  upgFortuneDesc: 'Больше монет за каждый уровень.',
  sound: 'Звук',
  music: 'Музыка',
  language: 'Язык',
  quality: 'Качество',
  qualityAuto: 'Авто',
  qualityHigh: 'Высокое',
  qualityLow: 'Низкое',
  reset: 'Сбросить прогресс',
  resetConfirm: 'Стереть весь прогресс?',
  yes: 'Да',
  no: 'Нет',
  progressNotSaved: 'В этом окне прогресс не сохранится.',
  credits: 'Физическая головоломка о терпении.',
  world: 'Мир',
  complete: 'Пройдено',
  bonusTitle: 'Бонус',
  bonusIntact: 'Целые',
  materialWood: 'Дерево',
  materialBlock: 'Блок',
  materialStone: 'Камень',
  materialIce: 'Лёд',
  materialRubber: 'Резина',
  materialMetal: 'Металл',
  materialGlass: 'Стекло',
  materialObsidian: 'Обсидиан',
  materialFoam: 'Пенопласт',
  materialBomb: 'Бомба',
  newMaterial: 'Новый материал',
  hintWood: 'Простое и предсказуемое.',
  hintBlock: 'Блестящий и предсказуемый. Нажми, чтобы разбить.',
  hintStone: 'Тяжёлый. Падает с силой.',
  hintIce: 'Почти без трения. Всё скользит.',
  hintRubber: 'Пружинит и цепляется.',
  hintMetal: 'Очень тяжёлый. Давит всё, что ниже.',
  hintGlass: 'Разбивается от сильного удара.',
  hintObsidian: 'Его не разбить.',
  hintFoam: 'Слишком лёгкий, чтобы держать вес.',
  hintBomb: 'Забирает с собой соседей.',
  themePuzzle: 'Пазл',
  themeNeon: 'Неон',
  themeFuturistic: 'Футуризм',
  themeRustic: 'Деревня',
  themeClassic: 'Классика',
  themeCandy: 'Сладости',
  themeIce: 'Лёд',
  themeLava: 'Лава',
  themePaper: 'Бумага',
  revive: 'Отменить ход',
  videoIndisponivel: 'Сейчас нет доступных видео',
  carregandoVideo: 'Загрузка видео…',
  removeAds: 'Убрать рекламу',
  removeAdsDesc: 'Без рекламы между уровнями. Видео по желанию остаются.',
  noAdsDone: 'Реклама отключена. Спасибо!',
  restorePurchases: 'Восстановить покупки',
  restoreNone: 'Нет покупок для восстановления',
  purchasePending: 'Платёж обрабатывается. Реклама исчезнет после подтверждения.',
  purchaseError: 'Покупка не удалась. Попробуй позже.',
  privacyOptions: 'Конфиденциальность',
};

/**
 * O rotulo dos botoes de video, em cada idioma: `comVideo` vai depois do
 * texto do botao (voltar uma jogada, pular fase, bonus diario, dobrar), e
 * `verVideo` e o botao de video da loja.
 * @type {Record<string, {comVideo: string, verVideo: string}>}
 */
export const VIDEO = {
  en: { comVideo: '{0} (video)', verVideo: 'Watch video' },
  pt: { comVideo: '{0} (vídeo)', verVideo: 'Ver vídeo' },
  es: { comVideo: '{0} (vídeo)', verVideo: 'Ver vídeo' },
  fr: { comVideo: '{0} (vidéo)', verVideo: 'Voir la vidéo' },
  it: { comVideo: '{0} (video)', verVideo: 'Guarda il video' },
  de: { comVideo: '{0} (Video)', verVideo: 'Video ansehen' },
  tr: { comVideo: '{0} (video)', verVideo: 'Video izle' },
  ru: { comVideo: '{0} (видео)', verVideo: 'Смотреть видео' },
};

/** O nome do russo no seletor de idioma dos ajustes. */
export const NOME_RUSSO = 'Русский';

let feito = false;

/** Poe o russo e os rotulos de video nas tabelas de core/i18n.js, uma vez so. */
export function textosDaGamePush() {
  if (feito) return;
  feito = true;
  acrescentaTextos('ru', RUSSO, NOME_RUSSO);
  for (const [lang, tabela] of Object.entries(VIDEO)) acrescentaTextos(lang, tabela);
}
