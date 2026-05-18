import { useEffect, useState } from 'react';

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
      showMessage('新增客人成功');
    } else {
      showMessage('新增客人失敗');
    }
  };

  const loadBalances = async (id) => {
    const res = await fetch(`http://localhost:3000/balances/${id}`);
    const data = await res.json();
    setBalances(Array.isArray(data) ? data : []);
  };

  const findCustomer = async () => {
    const id = customerId.trim();

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
    await loadBalances(id);
  };

  const purchase = async () => {
    if (!customer) return;

    const res = await fetch('http://localhost:3000/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customer.customer_id,
        item_id: Number(itemId),
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
        value={customerName}
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

      {message && <p>{message}</p>}

      {customer && (
        <div>
          <h2>客人資訊</h2>

          <div>名字：{customer.customer_name}</div>
          <div>手機：{customer.customer_phone ?? '無手機'}</div>

          <h2>購買寄杯</h2>

          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >

            {items.map((item) => (

              <option
                key={item.item_id}
                value={item.item_id}
              >
                {item.item_name}
              </option>

            ))}

          </select>

          <input
            placeholder="購買杯數"
            value={purchaseAmount}
            onChange={(e) => setPurchaseAmount(e.target.value)}
          />

          <button type="button" onClick={purchase}>
            購買 {purchaseAmount} 杯
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
    </div>
  );
}

export default App;