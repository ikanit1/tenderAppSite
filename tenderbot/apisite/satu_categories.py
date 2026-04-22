"""
Классификация товаров по категориям для SATU.KZ.

Плоский список ~35 категорий. Каждый товар попадает в первую подходящую
категорию по ключевым словам в (model + " " + name).lower().
Если ни одно ключевое слово не совпало — категория «Прочее».
"""

# Порядок важен: первое совпадение побеждает.
# Более специфичные категории идут раньше более общих.
CATEGORIES: dict[str, list[str]] = {
    "Видеокамеры": [
        "видеокамер", "камер", "camera",
        "ipc-h", "hac-b", "hac-t", "hac-d", "hac-hdw", "hac-hfw",
        "bullet", "cruiser", "turret", "dome",
        "cube poe", "cell pt", "cell 3c", "bulb cam", "cue ", "dk1 ",
        "ipc-pt", "ipc-eb",
    ],
    "Видеорегистраторы": [
        "регистратор", "nvr", "xvr", "dvr",
    ],
    "Коммутаторы": [
        "коммутатор", "switch", "свитч",
        "pfs3", "pfs4", "cs4", "sf10", "sg40",
        "dh-s30", "dh-s40", "dh-cs", "dh-hs", "lr2",
    ],
    "Точки доступа и маршрутизаторы": [
        "точка доступа", "access point",
        "pfm920", "wb2-", "маршрутизатор", "router",
    ],
    "Мониторы и дисплеи": [
        "монитор", "monitor",
        "dhi-lm", "ldv65", "ltv", "дисплей", "display", "lph", "lch",
    ],
    "Жёсткие диски": [
        "жёсткий диск", "жесткий диск", "hdd", "ssd",
        "st1000", "st2000", "st4000", "st8000", "st10000",
    ],
    "Кронштейны и крепёж": [
        "кронштейн", "крепёж", "крепеж",
        "pfb", "pfa1", "pft", "монтажное основание",
    ],
    "Контроль доступа (СКУД)": [
        "контроллер", "скуд", "контроль доступа",
        "домофон", "вызывная панель", "видеодомофон",
        "считыватель", "доводчик", "кнопка выхода",
        "rfid", "замок", "электрозамок",
    ],
    "Аудио и видеотехника": [
        "усилитель", "колонка", "динамик",
        "гарнитура", "спикерфон", "конференц",
    ],
    "Кабель и провод": [
        "кабель", "cable", "провод", "hdmi", "шнур", "патч-корд", "витая пара",
    ],
    "Кабельные каналы": [
        "кабельный канал", "кабель-канал", "ckk", "ckmp",
    ],
    "Лотки и аксессуары лотков": [
        "лоток", "clp1", "clp2", "cln", "clw", "clm", "clp10",
    ],
    "Автоматические выключатели": [
        "автоматический выключатель", "выключатель автоматический",
        "автомат модульный",
    ],
    "Дифференциальная защита": [
        "дифференциальный", "узо", "авдт", "диф ",
    ],
    "Контакторы и пускатели": [
        "контактор", "пускатель",
        "контакт состояния", "вспомогательный контакт", "расцепитель",
    ],
    "Светодиодные лампы": [
        "светодиодная лампа", "лампа светодиодная",
        "led лампа", "лампа led", "смарт лампочка",
    ],
    "Светильники и прожекторы": [
        "светильник", "прожектор",
    ],
    "Светодиодные ленты": [
        "светодиодная лента", "лента светодиодная", "led лента",
    ],
    "Наконечники и гильзы": [
        "наконечник", "гильза",
    ],
    "Розетки и выключатели": [
        "розетка",
        "выключатель клавиш", "выключатель одно", "выключатель двух",
        "выключатель 1-клав", "выключатель 2-клав", "рамка",
    ],
    "Датчики": [
        "датчик движения", "датчик",
    ],
    "Реле": [
        "реле",
    ],
    "Электродвигатели": [
        "электродвигатель", "двигатель",
    ],
    "Шкафы и щиты": [
        "шкаф", "корпус", "бокс", "щит",
    ],
    "Трансформаторы": [
        "трансформатор",
    ],
    "Разъемы и коннекторы": [
        "разъем", "коннектор", "rj-45", "rj45", "b-rj45",
    ],
    "Блоки питания": [
        "блок питания", "источник питания", "power supply",
        "pfm3", "адаптер питания",
    ],
    "Зажимы и клеммы": [
        "зажим", "клемм", "шина",
    ],
    "Монтажные коробки": [
        "коробка", "монтажная коробка", "распределительная", "распаячная",
    ],
    "Частотные преобразователи": [
        "частотный преобразователь", "преобразователь частот",
        "cnt-a310", "drv",
    ],
    "Муфты и трубы": [
        "муфта", "труба", "гофр", "металлорукав",
    ],
    "Устройства плавного пуска": [
        "плавного пуска", "ats01",
    ],
    "Кнопки управления": [
        "кнопка", "переключатель кулачковый",
    ],
    "Патроны и стартёры": [
        "патрон", "стартёр", "стартер",
    ],
    "Счётчики электроэнергии": [
        "счетчик", "счётчик",
    ],
}

FALLBACK_CATEGORY = "Прочее"


def classify_product(model: str, name: str) -> str:
    """Возвращает название категории для товара или 'Прочее'."""
    text = f"{model} {name}".lower()
    for category, keywords in CATEGORIES.items():
        for kw in keywords:
            if kw in text:
                return category
    return FALLBACK_CATEGORY


def get_all_group_names() -> list[str]:
    """Возвращает упорядоченный список всех групп (включая 'Прочее' последним)."""
    return list(CATEGORIES.keys()) + [FALLBACK_CATEGORY]


def get_group_number(group_name: str) -> int:
    """Возвращает номер группы (1-based) для вкладки Export Groups Sheet."""
    names = get_all_group_names()
    try:
        return names.index(group_name) + 1
    except ValueError:
        return len(names)  # Прочее


# URL категорий на Satu.kz (проверено на satu.kz 2026-04-22)
SATU_CATEGORY_URLS: dict[str, str] = {
    "Видеокамеры":                    "https://satu.kz/Elektrooborudovanie",
    "Видеорегистраторы":              "https://satu.kz/Elektrooborudovanie",
    "Коммутаторы":                    "https://satu.kz/Kommutatory",
    "Точки доступа и маршрутизаторы": "https://satu.kz/Routeryi",
    "Мониторы и дисплеи":             "https://satu.kz/Monitory",
    "Жёсткие диски":                  "https://satu.kz/Zhestkie-diski",
    "Кронштейны и крепёж":            "https://satu.kz/Krepezhnye-materialy",
    "Контроль доступа (СКУД)":        "https://satu.kz/Elektrooborudovanie",
    "Аудио и видеотехника":           "https://satu.kz/Akusticheskie-sistemy",
    "Кабель и провод":                "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Кабельные каналы":               "https://satu.kz/Korobki-montazhnye",
    "Лотки и аксессуары лотков":      "https://satu.kz/Korobki-montazhnye",
    "Автоматические выключатели":     "https://satu.kz/Vyklyuchateli",
    "Дифференциальная защита":        "https://satu.kz/Rele",
    "Контакторы и пускатели":         "https://satu.kz/Kontaktory",
    "Светодиодные лампы":             "https://satu.kz/Lampochki",
    "Светильники и прожекторы":       "https://satu.kz/Led-osveschenie",
    "Светодиодные ленты":             "https://satu.kz/Led-osveschenie",
    "Наконечники и гильзы":           "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Розетки и выключатели":          "https://satu.kz/Rozetki-elektricheskie",
    "Датчики":                        "https://satu.kz/Datchiki",
    "Реле":                           "https://satu.kz/Rele",
    "Электродвигатели":               "https://satu.kz/Servodvigateli",
    "Шкафы и щиты":                   "https://satu.kz/Raspredelitelnye-schity",
    "Трансформаторы":                 "https://satu.kz/Transformatory",
    "Разъемы и коннекторы":           "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Блоки питания":                  "https://satu.kz/Bloki-pitaniya",
    "Зажимы и клеммы":                "https://satu.kz/Krepezhnye-materialy",
    "Монтажные коробки":              "https://satu.kz/Korobki-montazhnye",
    "Частотные преобразователи":      "https://satu.kz/Preobrazovateli-chastoty",
    "Муфты и трубы":                  "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Устройства плавного пуска":      "https://satu.kz/Ustrojstva-plavnogo-puska",
    "Кнопки управления":              "https://satu.kz/Vyklyuchateli",
    "Патроны и стартёры":             "https://satu.kz/Komplektuyuschie-dlya-svetovyh-priborov",
    "Счётчики электроэнергии":        "https://satu.kz/Schetchiki-elektroenergii",
    "Прочее":                         "https://satu.kz/Elektrooborudovanie",
}

# Объём поставки по категориям (единица/месяц)
SUPPLY_VOLUMES: dict[str, int] = {
    "Кабель и провод":            1000,
    "Кабельные каналы":           500,
    "Лотки и аксессуары лотков":  200,
}
SUPPLY_PERIOD: str = "месяц"
DEFAULT_SUPPLY_VOLUME: int = 100


def get_satu_category_url(category: str) -> str:
    """Возвращает URL категории на satu.kz."""
    return SATU_CATEGORY_URLS.get(category, "https://satu.kz/Elektrooborudovanie")


def get_supply_volume(category: str) -> int:
    """Возвращает объём поставки для категории."""
    return SUPPLY_VOLUMES.get(category, DEFAULT_SUPPLY_VOLUME)
