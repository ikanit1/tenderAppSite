import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Background from '../components/Background';
import Header from '../components/Header';
import { useCart } from '../hooks/useCart';
import { saveCartToAPI } from '../utils/cartApi';
import { withBaseUrl } from '../utils/baseUrl';

export default function Checkout() {
  const { cart, removeFromCart, updateQty, clearCart, totalSum, syncCart, setCartFromExternal } = useCart();
  const [delivery, setDelivery] = useState('transport');
  const [payment, setPayment] = useState('cash');
  const [installation, setInstallation] = useState('none'); // 'none' | 'professional'
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [room, setRoom] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submittedTotal, setSubmittedTotal] = useState(0);

  // Синхронизация корзины из cookie и API при монтировании компонента
  useEffect(() => {
    syncCart();
  }, [syncCart]);

  // Периодическая синхронизация с API (каждые 3 секунды)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncCart();
    }, 3000); // 3 секунды

    // Синхронизация при фокусе окна
    const handleFocus = () => {
      syncCart();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncCart]);

  // Fallback: корзина из URL (старые ссылки) — заменяем корзину, сохраняем в API, очищаем URL (один раз при монтировании)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cartParam = params.get('cart');
    if (!cartParam) return;
    let mounted = true;
    (async () => {
      try {
        const decodedCart = JSON.parse(decodeURIComponent(atob(cartParam)));
        if (!Array.isArray(decodedCart) || decodedCart.length === 0) {
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        const normalized = decodedCart.map((item) => ({
          model: String(item.model || '').trim(),
          name: (item.name || '').trim() || String(item.model || '').trim(),
          brand: (item.brand || '').trim() || '',
          price: item.price != null && !isNaN(item.price) ? Number(item.price) : (item.final_price != null && !isNaN(item.final_price) ? Number(item.final_price) : null),
          quantity: item.quantity != null && !isNaN(item.quantity) ? Math.max(1, Number(item.quantity)) : 1,
        })).filter((item) => item.model);
        await saveCartToAPI(normalized);
        if (mounted) setCartFromExternal(normalized);
        window.history.replaceState({}, '', window.location.pathname);
      } catch (error) {
        console.error('Failed to parse cart from URL', error);
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      // Можно перенаправить на главную, если корзина пуста
    }
  }, [cart]);

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return '0';
    return new Intl.NumberFormat('ru-RU').format(Math.round(price));
  };

  const imageUrl = (model) => {
    return model ? withBaseUrl(`/api/products/${encodeURIComponent(model)}/image`) : '';
  };

  const showAddressFields = delivery !== 'pickup1' && delivery !== 'pickup3';

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.startsWith('8')) value = '7' + value.slice(1);
    if (value.startsWith('7')) {
      let formatted = '+7';
      if (value.length > 1) formatted += ' (' + value.slice(1, 4);
      if (value.length >= 4) formatted += ') ' + value.slice(4, 7);
      if (value.length >= 7) formatted += '-' + value.slice(7, 9);
      if (value.length >= 9) formatted += '-' + value.slice(9, 11);
      setPhone(formatted);
    } else {
      setPhone(value);
    }
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;

    let address = '';
    const phoneValue = phone.trim();

    if (showAddressFields) {
      const cityValue = city.trim();
      const streetValue = street.trim();
      const houseValue = house.trim();

      if (!cityValue || !streetValue || !houseValue || !phoneValue) {
        alert('Пожалуйста, заполните все обязательные поля адреса доставки и номер телефона');
        return;
      }
      address = `${cityValue}, ${streetValue}, д. ${houseValue}`;
      if (room.trim()) {
        address += `, ${room.trim()}`;
      }
    } else {
      if (delivery === 'pickup1') {
        address = 'Самовывоз, город Астана, проспект Мангилик Ел, 40';
      } else if (delivery === 'pickup3') {
        address = 'Самовывоз, ул. Тажибаевой 184, офис 104, Алматы';
      }
      if (!phoneValue) {
        alert('Пожалуйста, укажите номер телефона для связи');
        return;
      }
    }

    const orderData = {
      items: cart.map((i) => ({
        model: i.model,
        name: i.name ?? '',
        brand: i.brand ?? '',
        quantity: i.quantity ?? 1,
        price: i.price != null ? i.price : i.final_price ?? null,
      })),
      installation: installation,
      delivery: {
        type: delivery,
        address,
        phone: phoneValue,
      },
      payment,
      comment: comment.trim(),
      total: totalSum,
      date: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      const response = await fetch(withBaseUrl('/api/checkout/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderData),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        let message = data.detail || data.message || 'Не удалось отправить заказ. Попробуйте позже.';
        if (Array.isArray(message)) {
          message = message.map((e) => e.msg || e.message || String(e)).join(' ');
        }
        alert(message);
        return;
      }
      setSubmittedTotal(totalSum);
      setOrderSuccess(true);
      clearCart();
    } catch (err) {
      alert('Не удалось отправить заказ. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <>
        <Background />
        <Header />
        <main className="checkout-main">
          <div className="container">
            <motion.div
              className="checkout-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <motion.div
                className="checkout-success-icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 14 }}
                aria-hidden
              >
                ✓
              </motion.div>
              <h2 className="checkout-success-title">Заказ принят в обработку</h2>
              <p className="checkout-success-text">
                Мы свяжемся с вами в ближайшее время для уточнения деталей.
                {submittedTotal > 0 && (
                  <span className="checkout-success-sum"> Сумма заказа: {formatPrice(submittedTotal)} ₸</span>
                )}
              </p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Link to="/" className="btn-action btn-primary checkout-success-btn">
                  Вернуться в каталог
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </main>
      </>
    );
  }

  if (cart.length === 0) {
    return (
      <>
        <Background />
        <Header />
        <main className="checkout-main">
          <div className="container">
            <div className="checkout-empty">
              <p>Корзина пуста</p>
              <Link to="/" className="btn-action btn-primary">Перейти в каталог</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Background />
      <Header />
      <main className="checkout-main">
        <motion.div
          className="container"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          <nav className="breadcrumbs" aria-label="Навигация">
            <Link to="/">Главная</Link>
            <span className="breadcrumbs-sep">—</span>
            <span>Оформление заказа</span>
          </nav>

          <h2 className="checkout-title">Оформление заказа</h2>

          <motion.section
            className="checkout-table-section"
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
          >
            <table className="checkout-table" aria-label="Состав заказа">
              <thead>
                <tr>
                  <th>Название товара</th>
                  <th>Модель</th>
                  <th>Количество</th>
                  <th>Цена</th>
                  <th>Всего</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => {
                  const priceLabel = item.price != null ? formatPrice(item.price) + ' ₸' : 'по запросу';
                  const lineTotal = item.price != null ? formatPrice((item.price || 0) * (item.quantity || 1)) + ' ₸' : '—';
                  return (
                    <tr key={item.model} className="checkout-row">
                      <td className="checkout-cell-name" data-label="">
                        <div className="checkout-cell-img">
                          <img src={imageUrl(item.model)} alt="" loading="lazy" onError={(e) => {
                            e.target.onerror = null;
                            e.target.parentElement.innerHTML = '<span class="placeholder-mini">📦</span>';
                          }} />
                        </div>
                        <span>{item.name}</span>
                      </td>
                      <td className="checkout-cell-model" data-label="Модель">{item.model}</td>
                      <td className="checkout-cell-qty" data-label="Кол-во">
                        <button type="button" className="checkout-qty-btn" onClick={() => updateQty(item.model, -1)}>−</button>
                        <span className="checkout-qty-num">{item.quantity || 1}</span>
                        <button type="button" className="checkout-qty-btn" onClick={() => updateQty(item.model, 1)}>+</button>
                      </td>
                      <td className="checkout-cell-price" data-label="Цена">{priceLabel}</td>
                      <td className="checkout-cell-total" data-label="Всего">{lineTotal}</td>
                      <td className="checkout-cell-remove" data-label="">
                        <button type="button" className="checkout-remove" onClick={() => removeFromCart(item.model)} title="Удалить">×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="checkout-total-row">
              <span>Итого: <strong>{formatPrice(totalSum)}</strong> ₸</span>
              <span className="checkout-vat">(с учётом НДС)</span>
            </div>
          </motion.section>

          <motion.div
            className="checkout-form-grid"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          >
            <motion.section
              className="checkout-card checkout-delivery"
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            >
              <h3 className="checkout-section-title">
                <span className="checkout-icon">🚚</span>
                ДОСТАВКА
              </h3>
              <div className="checkout-radios">
                <label className="checkout-radio">
                  <input type="radio" name="delivery" value="transport" checked={delivery === 'transport'} onChange={(e) => setDelivery(e.target.value)} />
                  <span>Транспортной компанией по Казахстану</span>
                </label>
                <label className="checkout-radio">
                  <input type="radio" name="delivery" value="courier" checked={delivery === 'courier'} onChange={(e) => setDelivery(e.target.value)} />
                  <span>Курьером по городу Астана</span>
                </label>
                <label className="checkout-radio">
                  <input type="radio" name="delivery" value="pickup1" checked={delivery === 'pickup1'} onChange={(e) => setDelivery(e.target.value)} />
                  <span>Самовывоз, город Астана, проспект Мангилик Ел, 40</span>
                </label>
                <label className="checkout-radio">
                  <input type="radio" name="delivery" value="pickup3" checked={delivery === 'pickup3'} onChange={(e) => setDelivery(e.target.value)} />
                  <span>Самовывоз, ул. Тажибаевой 184, офис 104, Алматы</span>
                </label>
              </div>
              <div className="checkout-address-form">
                {showAddressFields && (
                  <div className="checkout-address-fields">
                    <div className="checkout-form-row">
                      <div className="checkout-form-group">
                        <label htmlFor="deliveryCity" className="checkout-label">Город <span className="required">*</span></label>
                        <input type="text" id="deliveryCity" className="checkout-input" placeholder="Например: Астана" value={city} onChange={(e) => setCity(e.target.value)} required />
                      </div>
                      <div className="checkout-form-group">
                        <label htmlFor="deliveryStreet" className="checkout-label">Улица <span className="required">*</span></label>
                        <input type="text" id="deliveryStreet" className="checkout-input" placeholder="Например: Абая" value={street} onChange={(e) => setStreet(e.target.value)} required />
                      </div>
                    </div>
                    <div className="checkout-form-row">
                      <div className="checkout-form-group">
                        <label htmlFor="deliveryHouse" className="checkout-label">Дом <span className="required">*</span></label>
                        <input type="text" id="deliveryHouse" className="checkout-input" placeholder="Например: 56" value={house} onChange={(e) => setHouse(e.target.value)} required />
                      </div>
                      <div className="checkout-form-group">
                        <label htmlFor="deliveryRoom" className="checkout-label">Помещение/Офис</label>
                        <input type="text" id="deliveryRoom" className="checkout-input" placeholder="Например: офис 104" value={room} onChange={(e) => setRoom(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
                <div className="checkout-form-row">
                  <div className="checkout-form-group checkout-form-group-full">
                    <label htmlFor="deliveryPhone" className="checkout-label">Номер телефона <span className="required">*</span></label>
                    <input type="tel" id="deliveryPhone" className="checkout-input" placeholder="+7 (XXX) XXX-XX-XX" value={phone} onChange={handlePhoneChange} required />
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              className="checkout-card checkout-payment"
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            >
              <h3 className="checkout-section-title">
                <span className="checkout-icon">💳</span>
                ОПЛАТА
              </h3>
              <div className="checkout-radios">
                <label className="checkout-radio">
                  <input type="radio" name="payment" value="cash" checked={payment === 'cash'} onChange={(e) => setPayment(e.target.value)} />
                  <span>Наличными в городе Астана</span>
                </label>
                <label className="checkout-radio">
                  <input type="radio" name="payment" value="transfer" checked={payment === 'transfer'} onChange={(e) => setPayment(e.target.value)} />
                  <span>Безналичная оплата</span>
                </label>
                <label className="checkout-radio">
                  <input type="radio" name="payment" value="card" checked={payment === 'card'} onChange={(e) => setPayment(e.target.value)} />
                  <span>Оплата картой Visa/MasterCard</span>
                </label>
                <label className="checkout-radio">
                  <input type="radio" name="payment" value="kaspi" checked={payment === 'kaspi'} onChange={(e) => setPayment(e.target.value)} />
                  <span>Оплата KaspiPay</span>
                </label>
              </div>
            </motion.section>

            <motion.section
              className="checkout-card checkout-installation"
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            >
              <h3 className="checkout-section-title">
                <span className="checkout-icon">🛠</span>
                МОНТАЖНЫЕ РАБОТЫ
              </h3>
              <div className="checkout-radios">
                <label className="checkout-radio">
                  <input type="radio" name="installation" value="none" checked={installation === 'none'} onChange={(e) => setInstallation(e.target.value)} />
                  <span>Мне не нужен монтаж</span>
                </label>
                <label className="checkout-radio">
                  <input type="radio" name="installation" value="professional" checked={installation === 'professional'} onChange={(e) => setInstallation(e.target.value)} />
                  <span>Нужен профессиональный монтаж «под ключ»</span>
                </label>
              </div>
              <div className="checkout-installation-warranty">
                На все монтажные работы гарантия 36 месяцев
              </div>
            </motion.section>
          </motion.div>

          <motion.section
            className="checkout-card checkout-comment"
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
          >
            <h3 className="checkout-section-title">
              <span className="checkout-icon">📝</span>
              КОММЕНТАРИЙ К ЗАКАЗУ
            </h3>
            <textarea
              id="orderComment"
              className="checkout-textarea"
              placeholder="Дополнительная информация к заказу..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            ></textarea>
          </motion.section>

          <motion.div
            className="checkout-actions"
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
          >
            <button
              type="button"
              className="btn-action btn-success btn-large"
              id="checkoutSubmit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Отправка…' : 'Оформить заказ'}
            </button>
            <Link to="/" className="btn-action btn-secondary">
              Отмена
            </Link>
          </motion.div>
        </motion.div>
      </main>
    </>
  );
}
