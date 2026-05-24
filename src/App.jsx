import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [balances, setBalances] = useState([]);
  const [purchaseAmount, setPurchaseAmount] = useState('1');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');

  const API = 'https://prepaid-coffee-system.onrender.com';

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 1500);
  };

  const loadItems = async () => {
    const res = await fetch(`${API}/items`);
    const data = await res.json();

    setItems(data);
  };

  useEffect(() => {
  fetch(`${API}/ping`);
  }, []);

  useEffect(() => {
    loadItems();
  }, []);

  const addCustomer = async () => {
    if (!customerName.trim()) {
      showMessage('請輸入名字');
      return;
    }

    const res = await fetch(`${API}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setCustomerName('');
      setCustomerPhone('');

      setCustomerId(data.customer_id);

      findCustomer(data.customer_id);

      showMessage('新增客戶成功');
    } else {
      showMessage('新增客戶失敗');
    }
  };

  const loadBalances = async (id) => {
    const res = await fetch(`${API}/balances/${id}`);
    const data = await res.json();

    setBalances(Array.isArray(data) ? data : []);
  };

  const findCustomer = async (targetId) => {
    const id =
      typeof targetId === 'string' || typeof targetId === 'number'
        ? String(targetId).trim()
        : customerId.trim();

    setCustomer(null);
    setBalances([]);

    if (!id) return;

    const res = await fetch(`${API}/customers/${id}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      showMessage('查無客人');
      return;
    }

    setCustomer(data[0]);

    await loadBalances(data[0].customer_id);
  };

  const purchase = async () => {
    if (!customer) return;

    if (!selectedItemId) {
      showMessage('請選擇品項');
      return;
    }

    const res = await fetch(`${API}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customer.customer_id,
        item_id: selectedItemId,
        amount: Number(purchaseAmount),
      }),
    });

    if (res.ok) {
      showMessage('購買成功');

      await loadBalances(customer.customer_id);
    } else {
      showMessage('購買失敗');
    }
  };

  const redeem = async (item_id) => {
    if (!customer) return;

    const res = await fetch(`${API}/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customer.customer_id,
        item_id,
      }),
    });

    if (res.ok) {
      showMessage('兌換成功');

      await loadBalances(customer.customer_id);
    } else {
      showMessage('兌換失敗');
    }
  };

  return (
    <div className="app">
      <h1>咖啡寄杯系統</h1>

      <h2>新增客人</h2>

      <input
        className="input"
        placeholder="名字"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
      />

      <input
        className="input"
        placeholder="手機"
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
      />

      <button type="button" onClick={addCustomer}>
        加入新的客人
      </button>

      <h2>查詢客人</h2>
      <div>測試可輸入1，免費後端會休眠，需等待10秒</div>

      <input
        className="input"
        placeholder="輸入客人ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      />

      <button type="button" onClick={findCustomer}>
        查詢
      </button>

      {customer && (
        <>
          <h2>客人資訊</h2>

          <div className="customer-info">
            <div>編號：{customer.customer_id}</div>
            <div>名字：{customer.customer_name}</div>
            <div>手機：{customer.customer_phone ?? '無手機'}</div>
          </div>

          <h2>寄杯餘額</h2>

          {balances.length > 0 ? (
            <ul>
              {balances.map((balance) => (
                <li key={balance.balance_id}>
                  {balance.item_name}：{balance.remaining_cups} 杯

                  <button
                    type="button"
                    onClick={() => redeem(balance.item_id)}
                  >
                    兌換
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div>沒寄杯</div>
          )}

          <h2>增加寄杯</h2>

          <div className="item-grid">
            {items.map((item) => (
              <button
                key={item.item_id}
                onClick={() => setSelectedItemId(item.item_id)}
                className={
                  selectedItemId === item.item_id ? 'selected' : ''
                }
              >
                {item.item_name}
              </button>
            ))}
          </div>

          <input
            className="input"
            placeholder="增加杯數"
            type="number"
            min="1"
            value={purchaseAmount}
            onChange={(e) => setPurchaseAmount(e.target.value)}
          />

          <div>
            <button type="button" onClick={purchase}>
              加值
            </button>

            <button
              type="button"
              onClick={() => {
                setPurchaseAmount(10);
              }}
            >
              10 杯
            </button>

            <button
              type="button"
              onClick={() => {
                setPurchaseAmount(20);
              }}
            >
              20 杯
            </button>
          </div>
        </>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}

export default App;