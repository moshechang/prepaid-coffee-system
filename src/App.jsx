import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [balances, setBalances] = useState([]);
  const [itemId, setItemId] = useState('1');
  const [purchaseAmount, setPurchaseAmount] = useState('1');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 1500);
  };

  const loadItems = async () => {

    const res = await fetch(
      'http://localhost:3000/items'
    );

    const data = await res.json();

    setItems(data);

  };

  useEffect(() => {

    loadItems();

  }, []);

  const addCustomer = async () => {
    if (!customerName.trim()) {
      showMessage('請輸入名字');
      return;
    }

    const res = await fetch('http://localhost:3000/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null
      })
    });

    if (res.ok) {
      setCustomerName('');
      setCustomerPhone('');
      await findCustomer('latest');
      setCustomerId(data[0].customer_id);
      showMessage('新增客戶成功');
    } else {
      showMessage('新增客戶失敗');
    }
  };

  const loadBalances = async (id) => {
    const res = await fetch(`http://localhost:3000/balances/${id}`);
    const data = await res.json();
    setBalances(Array.isArray(data) ? data : []);
  };

  const findCustomer = async (targetId) => {
    const id = typeof targetId === 'string' || typeof targetId === 'number'
      ? String(targetId).trim()
      : customerId.trim();

    setCustomer(null);
    setBalances([]);

    if (!id) return;

    const res = await fetch(`http://localhost:3000/customers/${id}`);
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

    const res = await fetch('http://localhost:3000/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customer.customer_id,
        item_id: selectedItemId,
        amount: Number(purchaseAmount)
      })
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

    const res = await fetch('http://localhost:3000/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customer.customer_id,
        item_id
      })
    });

    if (res.ok) {
      showMessage('兌換成功');
      await loadBalances(customer.customer_id);
    } else {
      showMessage('兌換失敗');
    }
  };

  return (
    <div>
      <h1>咖啡寄杯系統</h1>

      <h2>新增客人</h2>

      <input
        placeholder="名字"
        value={customerName} class="form-control"
        onChange={(e) => setCustomerName(e.target.value)}
      />

      <input
        placeholder="手機"
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
      />

      <button type="button" onClick={addCustomer}>
        加入新的客人
      </button>

      <h2>查詢客人</h2>

      <input
        placeholder="輸入客人ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      />

      <button type="button" onClick={findCustomer}>
        查詢
      </button>

      {customer && (
        <div>
          <h2>客人資訊</h2>
          <div className="customer-info">
            <div>編號：{customer.customer_id}</div>
            <div>名字：{customer.customer_name}</div>
            <div>手機：{customer.customer_phone ?? '無手機'}</div>
          </div>

          <h2>購買寄杯</h2>

          <div className="item-grid">
            {items.map((item) => (
              <button
                key={item.item_id}
                onClick={() => setSelectedItemId(item.item_id)}
                className={selectedItemId === item.item_id ? 'selected' : ''}
              >
                {item.item_name}
              </button>
            ))}
          </div>

          <input
            placeholder="購買杯數" type="number" min="1"
            value={purchaseAmount}
            onChange={(e) => setPurchaseAmount(e.target.value)}
          />

          <button type="button" onClick={purchase}>
            購買
          </button>

          <button type="button" onClick={() => {setPurchaseAmount(10)}}>
            10 杯
          </button>

          <button type="button" onClick={() => {setPurchaseAmount(20)}}>
            20 杯
          </button>

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
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;