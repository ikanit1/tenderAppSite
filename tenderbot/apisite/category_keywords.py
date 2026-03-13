# Правила определения категории по ключевым словам (синхрон с фронтом Filters.jsx).
# Используется, когда в portal_export у товара category пустой.

# Порядок проверки категорий (первое совпадение выигрывает)
CATEGORY_ORDER = [
    "ip-cameras", "ip-recorders", "hd-cameras", "hd-recorders", "poe-switches",
    "monitors", "hdd", "cable", "wifi-bridges", "intercoms", "wifi-ap", "rj45",
    "switches", "power-supply", "mounts", "lenses", "ir-illuminators",
    "microphones", "speakers", "keyboards", "batteries", "housings", "other",
]

_EXCLUDE_COMMON = [
    "камера", "camera", "видеокамера", "ipc", "ip-camera",
    "регистратор", "nvr", "dvr", "recorder", "видеорегистратор",
    "коммутатор", "switch",
    "точка доступа", "access point", "ap", "wifi точка", "wi-fi точка",
    "мост", "bridge", "радиомост",
    "монитор", "monitor", "экран",
    "диск", "hdd", "hard drive",
    "домофон", "intercom", "видеодомофон",
    "rj45", "коннектор", "аксессуар", "jack",
    "кабель", "cable", "utp",
    "блок питания", "power supply", "адаптер", "adapter",
    "кронштейн", "bracket", "mount", "крепление",
    "объектив", "lens", "линза",
    "прожектор", "illuminator", "ir", "подсветка",
    "микрофон", "microphone", "mic",
    "колонка", "speaker", "динамик", "siren",
    "клавиатура", "keyboard", "пульт", "control panel",
    "аккумулятор", "battery", "батарея",
    "корпус", "housing", "кожух",
    "роутер", "router", "маршрутизатор",
]
# Для ip-cameras не исключаем слова «камера»/camera — иначе камеры вылетают из своей категории.
# Исключаем ahd/tvi/cvi/hd — чтобы AHD/TVI/CVI/HD камеры шли в hd-cameras, а не в ip-cameras.
_EXCLUDE_IP_CAMERAS = ["ahd", "tvi", "cvi", "hd", "hd-dvr", "dvr"] + [
    x for x in _EXCLUDE_COMMON if x not in ("камера", "camera", "видеокамера", "ipc", "ip-camera")
]
# Для регистраторов не исключаем слова «регистратор»/dvr/nvr/recorder — иначе регистраторы вылетают из своей категории
_RECORDER_WORDS = ("регистратор", "nvr", "dvr", "recorder", "видеорегистратор")
_EXCLUDE_IP_RECORDERS = ["камера", "camera", "видеокамера", "ipc", "ip-camera", "hd", "dvr", "hd-dvr"] + [
    x for x in _EXCLUDE_COMMON if x not in _RECORDER_WORDS
]
_EXCLUDE_HD_RECORDERS = ["ip", "nvr", "ip-nvr", "камера", "camera", "видеокамера", "ipc"] + [
    x for x in _EXCLUDE_COMMON if x not in _RECORDER_WORDS
]
# Для HD-камер не исключаем камера/camera/видеокамера/hd/ahd/tvi/cvi
_HD_CAMERA_WORDS = ("камера", "camera", "видеокамера", "ipc", "ip-camera", "hd", "ahd", "tvi", "cvi")
_EXCLUDE_HD_CAMERAS = ["ip", "ipc", "ip-camera", "ip видеокамера"] + [
    x for x in _EXCLUDE_COMMON if x not in _HD_CAMERA_WORDS
]
# Для радиомостов не исключаем мост/bridge/радиомост. Не исключаем "wifi точка"/"wi-fi точка" —
# иначе названия вроде "Радиомост Wi-Fi точка" вылетают из категории.
_BRIDGE_WORDS = ("мост", "bridge", "радиомост")
_EXCLUDE_WIFI_BRIDGES = ["точка доступа", "access point", "ap"] + [
    x for x in _EXCLUDE_COMMON
    if x not in _BRIDGE_WORDS and x not in ("wifi точка", "wi-fi точка")
]

CATEGORY_RULES = {
    "ip-cameras": {
        "include": ["ip", "ipc", "видеокамера", "camera", "ip-camera", "ip camera"],
        "exclude": _EXCLUDE_IP_CAMERAS,
        "require": ["камера", "camera"],
    },
    "ip-recorders": {
        "include": ["ip", "nvr", "регистратор", "recorder", "ip-nvr", "ip nvr", "ip видеорегистратор"],
        "exclude": _EXCLUDE_IP_RECORDERS,
        "require": ["регистратор", "nvr", "recorder"],
    },
    "hd-cameras": {
        "include": ["hd", "ahd", "tvi", "cvi", "видеокамера", "camera", "hd-camera", "hd camera"],
        "exclude": _EXCLUDE_HD_CAMERAS,
        "require": ["камера", "camera"],
    },
    "hd-recorders": {
        "include": ["hd", "dvr", "регистратор", "recorder", "hd-dvr", "hd dvr", "hd видеорегистратор", "видеорегистратор"],
        "exclude": _EXCLUDE_HD_RECORDERS,
        "require": ["регистратор", "dvr", "recorder", "видеорегистратор"],
    },
    "poe-switches": {
        "include": ["poe", "pces", "коммутатор", "switch", "poe switch", "poe-switch", "poe коммутатор"],
        "exclude": [
            "камера", "camera", "видеокамера", "ipc", "ip-camera",
            "регистратор", "nvr", "dvr", "recorder", "видеорегистратор",
            "точка доступа", "access point", "ap", "wifi точка", "wi-fi точка",
            "мост", "bridge", "радиомост", "монитор", "monitor", "экран",
            "диск", "hdd", "hard drive", "домофон", "intercom",
            "rj45", "коннектор", "jack", "кабель", "cable", "utp",
            "блок питания", "power supply", "адаптер", "adapter",
            "кронштейн", "bracket", "mount", "крепление", "объектив", "lens", "линза",
            "прожектор", "illuminator", "ir", "подсветка", "микрофон", "microphone", "mic",
            "колонка", "speaker", "динамик", "siren", "клавиатура", "keyboard", "пульт", "control panel",
            "аккумулятор", "battery", "батарея", "корпус", "housing", "кожух",
            "роутер", "router", "маршрутизатор",
        ],
        # Только товары с poe/pces — иначе «Коммутатор без PoE» попадает сюда вместо switches
        "require": ["poe", "pces"],
    },
    "monitors": {
        "include": ["монитор", "monitor", "экран", "display", "lcd монитор", "led монитор"],
        "exclude": [x for x in _EXCLUDE_COMMON if x not in ("монитор", "monitor", "экран")],
        "require": ["монитор", "monitor"],
    },
    "hdd": {
        "include": ["диск", "hdd", "hard drive", "жесткий диск", "hard disk", "жесткий", "storage"],
        "exclude": [x for x in _EXCLUDE_COMMON if x not in ("диск", "hdd", "hard drive")],
        "require": ["диск", "hdd", "hard", "drive"],
    },
    "cable": {
        "include": ["кабель", "cable", "utp", "витая", "витая пара", "twisted pair", "кабель utp", "кабель витая пара"],
        "exclude": [x for x in _EXCLUDE_COMMON if x not in ("кабель", "cable", "utp")],
        "require": ["кабель", "cable", "utp"],
    },
    "wifi-bridges": {
        "include": ["радиомост", "bridge", "wireless bridge", "радио мост", "wi-fi мост", "wifi мост"],
        "exclude": _EXCLUDE_WIFI_BRIDGES,
        "require": ["мост", "bridge"],
    },
    "intercoms": {
        "include": ["домофон", "intercom", "видеодомофон", "video intercom", "видео домофон"],
        "exclude": [x for x in _EXCLUDE_COMMON if x not in ("домофон", "intercom", "видеодомофон")],
        "require": ["домофон", "intercom"],
    },
    "wifi-ap": {
        "include": ["точка доступа", "access point", "wireless access point", "wi-fi точка", "wifi точка"],
        # Не исключаем «точка»/access/point/ap — иначе «Точка доступа» вылетает из своей категории
        "exclude": [
            "мост", "bridge", "радиомост", "камера", "camera", "видеокамера", "ipc", "ip-camera",
            "регистратор", "nvr", "dvr", "recorder", "коммутатор", "switch",
            "монитор", "monitor", "экран", "диск", "hdd", "домофон", "intercom",
            "rj45", "коннектор", "кабель", "cable", "utp", "блок питания", "power supply",
            "кронштейн", "bracket", "mount", "объектив", "lens", "прожектор", "illuminator",
            "микрофон", "microphone", "колонка", "speaker", "клавиатура", "keyboard",
            "аккумулятор", "battery", "корпус", "housing", "роутер", "router", "маршрутизатор",
        ],
        "require": ["точка доступа", "access point"],
    },
    "rj45": {
        "include": ["rj45", "аксессуар", "коннектор", "connector", "jack", "rj-45"],
        "exclude": [x for x in _EXCLUDE_COMMON if x not in ("rj45", "коннектор", "аксессуар", "jack")],
        "require": ["rj45", "коннектор", "connector", "jack"],
    },
    "switches": {
        "include": ["коммутатор", "switch", "network switch"],
        "exclude": [
            "poe", "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "точка", "access", "point", "ap", "мост", "bridge", "монитор", "monitor",
            "диск", "hdd", "домофон", "intercom", "rj45", "коннектор", "кабель", "cable",
            "блок питания", "power supply", "адаптер", "кронштейн", "bracket", "mount", "крепление",
            "объектив", "lens", "прожектор", "illuminator", "ir", "микрофон", "microphone",
            "колонка", "speaker", "клавиатура", "keyboard", "аккумулятор", "battery",
            "корпус", "housing",
        ],
        "require": ["коммутатор", "switch"],
    },
    "power-supply": {
        "include": ["блок питания", "power supply", "адаптер", "adapter", "питание", "psu"],
        # Не исключаем блок питания/адаптер/питание — иначе блоки питания вылетают из своей категории
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка доступа", "access point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "кронштейн", "bracket", "mount", "объектив", "lens",
            "прожектор", "illuminator", "микрофон", "microphone", "колонка", "speaker",
            "клавиатура", "keyboard", "аккумулятор", "battery", "корпус", "housing",
        ],
        "require": ["блок", "power", "адаптер", "adapter", "питание"],
    },
    "mounts": {
        "include": ["кронштейн", "bracket", "mount", "крепление", "holder"],
        # Не исключаем кронштейн/bracket/mount/крепление — иначе кронштейны вылетают из своей категории
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка доступа", "access point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "объектив", "lens",
            "прожектор", "illuminator", "микрофон", "microphone", "колонка", "speaker",
            "клавиатура", "keyboard", "аккумулятор", "battery", "корпус", "housing",
        ],
        "require": ["кронштейн", "bracket", "mount", "крепление"],
    },
    "lenses": {
        "include": ["объектив", "lens", "линза"],
        # Не исключаем объектив/lens/линза — иначе объективы вылетают из своей категории
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка доступа", "access point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "прожектор", "illuminator", "микрофон", "microphone", "колонка", "speaker",
            "клавиатура", "keyboard", "аккумулятор", "battery", "корпус", "housing",
        ],
        "require": ["объектив", "lens", "линза"],
    },
    "ir-illuminators": {
        "include": ["прожектор", "illuminator", "ir", "инфракрасный", "infrared", "подсветка"],
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка", "access", "point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "объектив", "lens", "микрофон", "microphone", "колонка", "speaker",
            "клавиатура", "keyboard", "аккумулятор", "battery", "корпус", "housing",
        ],
        "require": ["прожектор", "illuminator", "ir", "подсветка"],
    },
    "microphones": {
        "include": ["микрофон", "microphone", "mic", "микро"],
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка", "access", "point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "объектив", "lens", "прожектор", "illuminator", "колонка", "speaker",
            "клавиатура", "keyboard", "аккумулятор", "battery", "корпус", "housing",
        ],
        "require": ["микрофон", "microphone", "mic"],
    },
    "speakers": {
        "include": ["колонка", "speaker", "динамик", "siren", "сирена"],
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка", "access", "point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "объектив", "lens", "прожектор", "illuminator", "микрофон", "microphone",
            "клавиатура", "keyboard", "аккумулятор", "battery", "корпус", "housing",
        ],
        "require": ["колонка", "speaker", "динамик", "siren", "сирена"],
    },
    "keyboards": {
        "include": ["клавиатура", "keyboard", "пульт", "control panel", "панель управления"],
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка", "access", "point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "объектив", "lens", "прожектор", "illuminator", "микрофон", "microphone",
            "колонка", "speaker", "аккумулятор", "battery", "корпус", "housing",
        ],
        "require": ["клавиатура", "keyboard", "пульт", "control panel", "панель"],
    },
    "batteries": {
        "include": ["аккумулятор", "battery", "батарея", "акб"],
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка", "access", "point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "объектив", "lens", "прожектор", "illuminator", "микрофон", "microphone",
            "колонка", "speaker", "клавиатура", "keyboard", "корпус", "housing",
        ],
        "require": ["аккумулятор", "battery", "батарея", "акб"],
    },
    "housings": {
        "include": ["корпус", "housing", "кожух", "защитный корпус", "weatherproof"],
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка", "access", "point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "объектив", "lens", "прожектор", "illuminator", "микрофон", "microphone",
            "колонка", "speaker", "клавиатура", "keyboard", "аккумулятор", "battery",
        ],
        "require": ["корпус", "housing", "кожух"],
    },
    "other": {
        "include": ["аксессуар", "accessory", "комплект", "kit", "набор"],
        "exclude": [
            "камера", "camera", "видеокамера", "регистратор", "nvr", "dvr",
            "коммутатор", "switch", "точка", "access", "point", "ap", "мост", "bridge",
            "монитор", "monitor", "диск", "hdd", "домофон", "intercom", "rj45", "коннектор",
            "кабель", "cable", "блок питания", "power supply", "кронштейн", "bracket", "mount",
            "объектив", "lens", "прожектор", "illuminator", "микрофон", "microphone",
            "колонка", "speaker", "клавиатура", "keyboard", "аккумулятор", "battery",
            "корпус", "housing",
        ],
        "require": [],
    },
}


def infer_category(product: dict) -> str:
    """По названию/модели/бренду определяет slug категории. Возвращает '' если не подошло ни одно правило."""
    name = (product.get("name") or "").strip()
    model = (product.get("model") or "").strip()
    brand = (product.get("brand") or "").strip()
    product_text = f"{name} {model} {brand}".lower()
    if not product_text:
        return ""

    for slug in CATEGORY_ORDER:
        rules = CATEGORY_RULES.get(slug)
        if not rules:
            continue
        exclude = rules.get("exclude") or []
        require = rules.get("require") or []
        include = rules.get("include") or []

        if exclude:
            if any(
                phrase.lower().strip() in product_text
                for phrase in exclude
                if phrase and phrase.strip()
            ):
                continue
        if require:
            if not any(
                phrase.lower().strip() in product_text
                for phrase in require
                if phrase and phrase.strip()
            ):
                continue
        if include:
            if not any(
                phrase.lower().strip() in product_text
                for phrase in include
                if phrase and phrase.strip()
            ):
                continue
        return slug
    return ""
