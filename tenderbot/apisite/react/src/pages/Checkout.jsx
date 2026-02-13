import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Background from '../components/Background';
import Header from '../components/Header';
import { useCart } from '../hooks/useCart';

export default function Checkout() {
  const { cart, removeFromCart, updateQty, clearCart, totalSum, syncCart, addToCart } = useCart();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState('transport');
  const [payment, setPayment] = useState('cash');
  const [installation, setInstallation] = useState('none'); // 'none' | 'professional'
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [room, setRoom] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');

  // Синхронизация корзины из localStorage при монтировании компонента
  useEffect(() => {
    syncCart();
  }, [syncCart]);

  // Чтение корзины из URL параметров (при переходе с основного сайта)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cartParam = params.get('cart');
    
    if (cartParam) {
      try {
        // Декодируем base64 строку в массив товаров
        const decodedCart = JSON.parse(decodeURIComponent(atob(cartParam)));
        
        if (Array.isArray(decodedCart) && decodedCart.length > 0) {
          // Добавляем товары в корзину
          // useCart.addToCart ожидает final_price, но также может использовать price
          decodedCart.forEach(item => {
            if (item.model) {
              addToCart({
                model: item.model,
                name: item.name,
                brand: item.brand,
                final_price: item.price != null ? item.price : undefined,
                price: item.price, // для совместимости
              }, item.quantity || 1);
            }
          });
          
          // Очищаем URL параметр после обработки
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch (error) {
        console.error('Failed to parse cart from URL', error);
        // Очищаем URL даже при ошибке
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [addToCart]);

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
    return model ? `/api/products/${encodeURIComponent(model)}/image` : '';
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

  const handleSubmit = () => {
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
      items: cart,
      installation: installation, // 'none' | 'professional'
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

    alert(`Заказ принят в обработку. Сумма: ${formatPrice(totalSum)} ₸`);
    clearCart();
    navigate('/');
  };

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
                      <td className="checkout-cell-name">
                        <div className="checkout-cell-img">
                          <img src={imageUrl(item.model)} alt="" loading="lazy" onError={(e) => {
                            e.target.onerror = null;
                            e.target.parentElement.innerHTML = '<span class="placeholder-mini">📦</span>';
                          }} />
                        </div>
                        <span>{item.name}</span>
                      </td>
                      <td className="checkout-cell-model">{item.model}</td>
                      <td className="checkout-cell-qty">
                        <button type="button" className="checkout-qty-btn" onClick={() => updateQty(item.model, -1)}>−</button>
                        <span className="checkout-qty-num">{item.quantity || 1}</span>
                        <button type="button" className="checkout-qty-btn" onClick={() => updateQty(item.model, 1)}>+</button>
                      </td>
                      <td className="checkout-cell-price">{priceLabel}</td>
                      <td className="checkout-cell-total">{lineTotal}</td>
                      <td>
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
            <button type="button" className="btn-action btn-success btn-large" id="checkoutSubmit" onClick={handleSubmit}>
              Оформить заказ
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
