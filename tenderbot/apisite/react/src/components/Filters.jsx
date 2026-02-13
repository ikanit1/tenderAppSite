import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CATEGORIES = [
  { value: 'ip-cameras', label: 'IP видеокамеры' },
  { value: 'ip-recorders', label: 'IP видеорегистраторы' },
  { value: 'hd-cameras', label: 'HD видеокамеры' },
  { value: 'hd-recorders', label: 'HD видеорегистраторы' },
  { value: 'poe-switches', label: 'PoE коммутаторы' },
  { value: 'monitors', label: 'Мониторы' },
  { value: 'hdd', label: 'Жесткие диски' },
  { value: 'cable', label: 'Кабель UTP' },
  { value: 'wifi-bridges', label: 'Радиомосты Wi-Fi' },
  { value: 'intercoms', label: 'Видеодомофоны' },
  { value: 'wifi-ap', label: 'Wi-Fi точки доступа' },
  { value: 'rj45', label: 'RJ45 аксессуары' },
  { value: 'switches', label: 'Коммутаторы без PoE' },
  { value: 'power-supply', label: 'Блоки питания' },
  { value: 'mounts', label: 'Кронштейны и крепления' },
  { value: 'lenses', label: 'Объективы' },
  { value: 'ir-illuminators', label: 'ИК-прожекторы' },
  { value: 'microphones', label: 'Микрофоны' },
  { value: 'speakers', label: 'Колонки' },
  { value: 'keyboards', label: 'Клавиатуры управления' },
  { value: 'batteries', label: 'Аккумуляторы' },
  { value: 'housings', label: 'Корпуса' },
  { value: 'other', label: 'Прочее оборудование' },
];

const CATEGORY_KEYWORDS = {
  'ip-cameras': {
    include: ['ip', 'ipc', 'видеокамера', 'camera', 'ip-camera', 'ip camera'],
    exclude: [
      'регистратор', 'nvr', 'dvr', 'recorder', 'видеорегистратор',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка', 'wi-fi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'аксессуар', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['камера', 'camera']
  },
  'ip-recorders': {
    include: ['ip', 'nvr', 'регистратор', 'recorder', 'ip-nvr', 'ip nvr', 'ip видеорегистратор'],
    exclude: [
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка', 'wi-fi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['регистратор', 'nvr', 'recorder']
  },
  'hd-cameras': {
    include: ['hd', 'ahd', 'tvi', 'cvi', 'видеокамера', 'camera', 'hd-camera', 'hd camera'],
    exclude: [
      'ip', 'ipc', 'ip-camera', 'ip видеокамера',
      'регистратор', 'nvr', 'dvr', 'recorder', 'видеорегистратор',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка', 'wi-fi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['камера', 'camera']
  },
  'hd-recorders': {
    include: ['hd', 'dvr', 'регистратор', 'recorder', 'hd-dvr', 'hd dvr', 'hd видеорегистратор'],
    exclude: [
      'ip', 'nvr', 'ip-nvr',
      'камера', 'camera', 'видеокамера', 'ipc',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка', 'wi-fi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['регистратор', 'dvr', 'recorder']
  },
  'poe-switches': {
    include: ['poe', 'коммутатор', 'switch', 'poe switch', 'poe-switch', 'poe коммутатор'],
    exclude: [
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'регистратор', 'nvr', 'dvr', 'recorder', 'видеорегистратор',
      'точка доступа', 'access point', 'ap', 'wifi точка', 'wi-fi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['poe', 'коммутатор', 'switch']
  },
  'monitors': {
    include: ['монитор', 'monitor', 'экран', 'display', 'lcd монитор', 'led монитор'],
    exclude: [
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'регистратор', 'nvr', 'dvr', 'recorder',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка',
      'мост', 'bridge', 'радиомост',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['монитор', 'monitor']
  },
  'hdd': {
    include: ['диск', 'hdd', 'hard drive', 'жесткий диск', 'hard disk', 'жесткий', 'storage'],
    exclude: [
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'регистратор', 'nvr', 'dvr', 'recorder',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['диск', 'hdd', 'hard', 'drive']
  },
  'cable': {
    include: ['кабель', 'cable', 'utp', 'витая', 'витая пара', 'twisted pair', 'кабель utp', 'кабель витая пара'],
    exclude: [
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'регистратор', 'nvr', 'dvr', 'recorder',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'jack',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['кабель', 'cable', 'utp']
  },
  'wifi-bridges': {
    include: ['радиомост', 'bridge', 'wireless bridge', 'радио мост', 'wi-fi мост', 'wifi мост'],
    exclude: [
      'точка доступа', 'access point', 'ap', 'wifi точка', 'wi-fi точка',
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'ahd', 'tvi', 'cvi',
      'регистратор', 'nvr', 'dvr', 'recorder',
      'коммутатор', 'switch',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['мост', 'bridge']
  },
  'intercoms': {
    include: ['домофон', 'intercom', 'видеодомофон', 'video intercom', 'видео домофон'],
    exclude: [
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'регистратор', 'nvr', 'dvr', 'recorder',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['домофон', 'intercom']
  },
  'wifi-ap': {
    include: ['точка доступа', 'access point', 'wireless access point', 'wi-fi точка', 'wifi точка'],
    exclude: [
      'мост', 'bridge', 'радиомост',
      'камера', 'camera', 'видеокамера', 'видео камера', 'видеокамера',
      'ipc', 'ip-camera', 'ip camera', 'ip видеокамера', 'ipc-', 'ipc-h',
      'ahd', 'tvi', 'cvi', 'ahd камера', 'tvi камера', 'cvi камера',
      'регистратор', 'nvr', 'dvr', 'recorder', 'видеорегистратор',
      'коммутатор', 'switch', 'коммутатор',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'rj45', 'коннектор', 'jack',
      'кабель', 'cable', 'utp',
      'видеонаблюдение', 'surveillance', 'видео',
      'блок питания', 'power supply', 'адаптер', 'adapter', 'psu',
      'кронштейн', 'bracket', 'mount', 'крепление', 'holder',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка', 'infrared',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren', 'сирена',
      'клавиатура', 'keyboard', 'пульт', 'control panel', 'панель управления',
      'аккумулятор', 'battery', 'батарея', 'акб',
      'корпус', 'housing', 'кожух', 'защитный корпус',
      'модуль', 'module', 'плата', 'board',
      'антенна', 'antenna', 'антенна',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['точка доступа', 'access point'] // Требуем точную фразу, а не отдельные слова
  },
  'rj45': {
    include: ['rj45', 'аксессуар', 'коннектор', 'connector', 'jack', 'rj-45'],
    exclude: [
      'камера', 'camera', 'видеокамера', 'ipc', 'ip-camera',
      'регистратор', 'nvr', 'dvr', 'recorder',
      'коммутатор', 'switch',
      'точка доступа', 'access point', 'ap', 'wifi точка',
      'мост', 'bridge', 'радиомост',
      'монитор', 'monitor', 'экран',
      'диск', 'hdd', 'hard drive',
      'домофон', 'intercom', 'видеодомофон',
      'кабель', 'cable', 'utp',
      'блок питания', 'power supply', 'адаптер', 'adapter',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens', 'линза',
      'прожектор', 'illuminator', 'ir', 'подсветка',
      'микрофон', 'microphone', 'mic',
      'колонка', 'speaker', 'динамик', 'siren',
      'клавиатура', 'keyboard', 'пульт', 'control panel',
      'аккумулятор', 'battery', 'батарея',
      'корпус', 'housing', 'кожух',
      'роутер', 'router', 'маршрутизатор'
    ],
    require: ['rj45', 'коннектор', 'connector', 'jack']
  },
  'switches': {
    include: ['коммутатор', 'switch', 'network switch'],
    exclude: [
      'poe',
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply', 'адаптер',
      'кронштейн', 'bracket', 'mount', 'крепление',
      'объектив', 'lens',
      'прожектор', 'illuminator', 'ir',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['коммутатор', 'switch']
  },
  'power-supply': {
    include: ['блок питания', 'power supply', 'адаптер', 'adapter', 'питание', 'psu'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['блок', 'power', 'адаптер', 'adapter', 'питание']
  },
  'mounts': {
    include: ['кронштейн', 'bracket', 'mount', 'крепление', 'holder', 'holder'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['кронштейн', 'bracket', 'mount', 'крепление']
  },
  'lenses': {
    include: ['объектив', 'lens', 'линза'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['объектив', 'lens', 'линза']
  },
  'ir-illuminators': {
    include: ['прожектор', 'illuminator', 'ir', 'инфракрасный', 'infrared', 'подсветка'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['прожектор', 'illuminator', 'ir', 'подсветка']
  },
  'microphones': {
    include: ['микрофон', 'microphone', 'mic', 'микро'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['микрофон', 'microphone', 'mic']
  },
  'speakers': {
    include: ['колонка', 'speaker', 'динамик', 'siren', 'сирена'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['колонка', 'speaker', 'динамик', 'siren', 'сирена']
  },
  'keyboards': {
    include: ['клавиатура', 'keyboard', 'пульт', 'control panel', 'панель управления'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: ['клавиатура', 'keyboard', 'пульт', 'control panel', 'панель']
  },
  'batteries': {
    include: ['аккумулятор', 'battery', 'батарея', 'акб'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'корпус', 'housing'
    ],
    require: ['аккумулятор', 'battery', 'батарея', 'акб']
  },
  'housings': {
    include: ['корпус', 'housing', 'кожух', 'защитный корпус', 'weatherproof'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery'
    ],
    require: ['корпус', 'housing', 'кожух']
  },
  'other': {
    include: ['аксессуар', 'accessory', 'комплект', 'kit', 'набор'],
    exclude: [
      'камера', 'camera', 'видеокамера',
      'регистратор', 'nvr', 'dvr',
      'коммутатор', 'switch',
      'точка', 'access', 'point', 'ap',
      'мост', 'bridge',
      'монитор', 'monitor',
      'диск', 'hdd',
      'домофон', 'intercom',
      'rj45', 'коннектор',
      'кабель', 'cable',
      'блок питания', 'power supply',
      'кронштейн', 'bracket', 'mount',
      'объектив', 'lens',
      'прожектор', 'illuminator',
      'микрофон', 'microphone',
      'колонка', 'speaker',
      'клавиатура', 'keyboard',
      'аккумулятор', 'battery',
      'корпус', 'housing'
    ],
    require: [] // Для "прочего" не требуем обязательных слов
  },
};

export default function Filters({ brands, onFilterChange, onReset, defaultCategory = 'ip-cameras' }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [brand, setBrand] = useState('');

  useEffect(() => {
    onFilterChange({ search, category, brand });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, brand]); // Убрали onFilterChange из зависимостей, чтобы избежать бесконечного цикла

  const handleReset = () => {
    setSearch('');
    setCategory(defaultCategory);
    setBrand('');
    if (onReset) onReset();
  };

  const tagsVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.03 } },
  };
  const tagVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  };

  return (
    <motion.div
      className="filters"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
    >
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="categorySelect">Категории</label>
          <select id="categorySelect" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Выберите категорию</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="brandSelect">Бренды</label>
          <select id="brandSelect" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Все бренды</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="filter-group filter-search">
          <label htmlFor="searchInput">Поиск</label>
          <div className="search-wrapper">
            <input
              type="text"
              id="searchInput"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-search">
              <span>🔍</span>
            </button>
          </div>
        </div>
      </div>

      <motion.div
        className="category-tags"
        variants={tagsVariants}
        initial="hidden"
        animate="visible"
      >
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.value}
            className={`category-tag ${category === cat.value ? 'active' : ''}`}
            onClick={() => setCategory(cat.value === category ? '' : cat.value)}
            variants={tagVariants}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            {cat.label}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

export { CATEGORY_KEYWORDS };
