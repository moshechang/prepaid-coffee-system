require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    trustServerCertificate: true
  }
};

//查所有客戶資料
app.get('/customers', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT *
      FROM customers c
      ORDER BY c.customer_id ASC
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: err.message
    });
  }
});

//查單一客戶資料
app.get('/customers/:id', async (req, res) => {

  const { id } = req.params;

  try {

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT *
        FROM customers
        WHERE customer_id = @id
      `);

    res.json(result.recordset);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

//查單一客戶下所有寄杯
app.get('/balances/:customerId', async (req, res) => {
  const { customerId } = req.params;

  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        SELECT
          b.balance_id,
          b.item_id,
          c.customer_name,
          i.item_name,
          b.remaining_cups
        FROM balances b
        JOIN customers c
          ON b.customer_id = c.customer_id
        JOIN items i
          ON b.item_id = i.item_id
        WHERE b.customer_id = @customerId
        AND b.remaining_cups > 0
        ORDER BY b.item_id ASC
      `);

    res.json(result.recordset);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
});

//查所有寄杯資料
app.get('/balances', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT
        b.balance_id,
        c.customer_name,
        i.item_name,
        b.remaining_cups
      FROM balances b
      JOIN customers c
        ON b.customer_id = c.customer_id
      JOIN items i
        ON b.item_id = i.item_id
      ORDER BY b.balance_id ASC
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

//查所有品項
app.get('/items', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT 
        item_id,
        item_name
      FROM items
      ORDER BY item_id ASC
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: err.message 
    });
  }
});

//查所有交易紀錄
app.get('/transactions', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT *
      FROM transactions
      ORDER BY transaction_id ASC
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: err.message 
    });
  }
});

//購買寄杯
app.post('/purchase', async (req, res) => {

  const { customer_id, item_id, amount } = req.body;

  if (amount<0) {
  throw new Error('數量不能小於0');
  }

  try {

    const pool = await sql.connect(dbConfig);

    // 檢查 balance 是否存在
    const checkResult = await pool.request()
      .input('customer_id', sql.Int, customer_id)
      .input('item_id', sql.Int, item_id)
      .query(`
        SELECT *
        FROM balances
        WHERE customer_id = @customer_id
          AND item_id = @item_id
      `);

    // 已存在 → UPDATE
    if (checkResult.recordset.length > 0) {
      await pool.request()
        .input('customer_id', sql.Int, customer_id)
        .input('item_id', sql.Int, item_id)
        .input('amount', sql.Int, amount)
        .query(`
          UPDATE balances
          SET remaining_cups = remaining_cups + @amount
          WHERE customer_id = @customer_id
            AND item_id = @item_id
        `);
    }

    // 不存在 → INSERT
    else {
      await pool.request()
        .input('customer_id', sql.Int, customer_id)
        .input('item_id', sql.Int, item_id)
        .input('amount', sql.Int, amount)
        .query(`
          INSERT INTO balances (
            customer_id,
            item_id,
            remaining_cups
          )
          VALUES (
            @customer_id,
            @item_id,
            @amount
          )
        `);
    }

    // 新增交易紀錄
    await pool.request()
      .input('customer_id', sql.Int, customer_id)
      .input('item_id', sql.Int, item_id)
      .input('amount', sql.Int, amount)
      .query(`
        INSERT INTO transactions (
          customer_id,
          item_id,
          amount,
          transaction_type,
          time_record
        )
        VALUES (
          @customer_id,
          @item_id,
          @amount,
          N'purchase',
          GETDATE()
        )
      `);

    res.json({
      message: '購買成功'
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({
      error: '購買失敗',
      detail: err.message
    });
  }
});

//兌換寄杯
app.post('/redeem', async (req, res) => {
  const { customer_id, item_id } = req.body;

  let transaction;

  try {
    const pool = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const request1 = new sql.Request(transaction);

    // 檢查還有餘杯則扣除額度
    await request1
      .input('customer_id', sql.Int, customer_id)
      .input('item_id', sql.Int, item_id)
      .query(`
        UPDATE balances
        SET remaining_cups = remaining_cups - 1
        WHERE customer_id = @customer_id
          AND item_id = @item_id
          AND remaining_cups >= 1
      `);

    // 新增交易紀錄
    const request2 = new sql.Request(transaction);
    await request2
      .input('customer_id', sql.Int, customer_id)
      .input('item_id', sql.Int, item_id)
      .query(`
        INSERT INTO transactions (
          customer_id,
          item_id,
          amount,
          transaction_type,
          time_record
        )
        VALUES (
          @customer_id,
          @item_id,
          -1,
          N'redeem',
          GETDATE()
        )
      `);
    
    await transaction.commit();

    res.json({
      message: '兌換成功'
    });

  } catch (err) {

    if (transaction) {
      await transaction.rollback();
    }
    console.error(err);

    res.status(400).json({
      error: err.message
    });

  }

});

//新增客人
app.post('/customers', async (req, res) => {

  const { customer_name, customer_phone } = req.body;

  if (customer_phone && !/^09\d{8}$/.test(customer_phone)) {
  return res.status(400).json({
    error: '電話格式錯誤'
  });
  }

  try {

    const pool = await sql.connect(dbConfig);

     await pool.request()
      .input('customer_name', sql.NVarChar, customer_name)
      .input('customer_phone', sql.NVarChar, customer_phone || null)
      .query(`
        INSERT INTO customers (
          customer_name,
          customer_phone
        )
        VALUES (
          @customer_name,
          @customer_phone
        )
      `);

    res.json({ message: '新增客人成功' });

  } catch (err) {
    res.status(400).json({
      error: '新增客人失敗',
      detail: err.message
    });
  }
});

//新增品項
app.post('/items', async (req, res) => {

  const { item_name } = req.body;

  try {

    const pool = await sql.connect(dbConfig);

     await pool.request()
      .input('item_name', sql.NVarChar, item_name)
      .query(`
        INSERT INTO items (
          item_name
        )
        VALUES (
          @item_name
        )
      `);

    res.json({ message: '新增品項成功' });

  } catch (err) {
    res.status(400).json({
      error: '新增品項失敗',
      detail: err.message
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});