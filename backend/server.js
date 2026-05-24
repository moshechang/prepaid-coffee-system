require('dotenv').config();

const express = require('express');

//const sql = require('mssql');
const { Pool } = require('pg');

const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

/*const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    trustServerCertificate: true
  }
};*/

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/ping', (req, res) => {
  res.send('ok');
});

//查所有客戶資料
app.get('/customers', async (req, res) => {
  try {
    //const pool = await sql.connect(dbConfig);
    const result = await pool.query(`
      SELECT *
      FROM customers c
      ORDER BY c.customer_id ASC
    `);//pool.request().query改pool.query

    res.json(result.rows);//recordset改rows

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

    //const pool = await sql.connect(dbConfig);

    const result = await pool
      .query(`
        SELECT *
        FROM customers
        WHERE customer_id = $1
      `, [id]);

    res.json(result.rows);

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
    //const pool = await sql.connect(dbConfig);

    const result = await pool
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
        WHERE b.customer_id = $1
        AND b.remaining_cups > 0
        ORDER BY b.item_id ASC
      `, [customerId]);

    res.json(result.rows);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
});

//查所有寄杯資料
app.get('/balances', async (req, res) => {
  try {
    //const pool = await sql.connect(dbConfig);

    const result = await pool.query(`
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

    res.json(result.rows);

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
    //const pool = await sql.connect(dbConfig);
    const result = await pool.query(`
      SELECT 
        item_id,
        item_name
      FROM items
      ORDER BY item_id ASC
    `);

    res.json(result.rows);

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
    //const pool = await sql.connect(dbConfig);
    const result = await pool.query(`
      SELECT *
      FROM transactions
      ORDER BY transaction_id ASC
    `);

    res.json(result.rows);

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

  if (amount < 0) {
    throw new Error('數量不能小於0');
  }

  try {

    //const pool = await sql.connect(dbConfig);

    // 檢查 balance 是否存在
    const checkResult = await pool.query(`
        SELECT *
        FROM balances
        WHERE customer_id = $1
          AND item_id = $2
      `, [customer_id, item_id]);

    // 已存在 → UPDATE
    if (checkResult.rows.length > 0) {
      await pool
        .query(`
          UPDATE balances
          SET remaining_cups = remaining_cups + $3
          WHERE customer_id = $1
            AND item_id = $2
        `, [customer_id, item_id, amount]);
    }

    // 不存在 → INSERT
    else {
      await pool
        /*.input('customer_id', sql.Int, customer_id)
        .input('item_id', sql.Int, item_id)
        .input('amount', sql.Int, amount)*/
        .query(`
          INSERT INTO balances (
            customer_id,
            item_id,
            remaining_cups
          )
          VALUES (
            $1,
            $2,
            $3
          )
        `, [customer_id, item_id, amount]);
    }

    // 新增交易紀錄
    await pool
      .query(`
        INSERT INTO transactions (
          customer_id,
          item_id,
          amount,
          transaction_type,
          time_record
        )
        VALUES (
          $1,
          $2,
          $3,
          'purchase',
          NOW()
        )
      `, [customer_id, item_id, amount]);

    res.json({
      message: '加值成功'
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({
      error: '加值失敗',
      detail: err.message
    });
  }
});

//兌換寄杯
app.post('/redeem', async (req, res) => {
  const { customer_id, item_id } = req.body;

  //let transaction;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    //const pool = await sql.connect(dbConfig);
    //transaction = new sql.Transaction(pool);
    //await transaction.begin();
    //const request1 = new sql.Request(transaction);

    // 檢查還有餘杯則扣除額度
    const updateResult = await client
      .query(`
        UPDATE balances
        SET remaining_cups = remaining_cups - 1
        WHERE customer_id = $1
          AND item_id = $2
          AND remaining_cups >= 1
      `, [customer_id, item_id]);

    if (updateResult.rowCount === 0) {
      throw new Error('沒有寄杯資料或杯數不足');
    }

    // 新增交易紀錄
    //const request2 = new sql.Request(transaction);
    await client
      .query(`
        INSERT INTO transactions (
          customer_id,
          item_id,
          amount,
          transaction_type,
          time_record
        )
        VALUES (
          $1,
          $2,
          -1,
          'redeem',
          NOW()
        )
      `, [customer_id, item_id]);

    //await transaction.commit();
    await client.query('COMMIT');

    res.json({
      message: '兌換成功'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    /*if (transaction) {
      await transaction.rollback();
    }*/
    console.error(err);

    res.status(400).json({
      error: '兌換失敗',
      detail: err.message
    });

  } finally {
    client.release();
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

    //const pool = await sql.connect(dbConfig);

    const result = await pool.query(`
        INSERT INTO customers (
          customer_name,
          customer_phone
        )
        VALUES (
          $1,
          $2
        )
        RETURNING *
      `, [customer_name, customer_phone || null]);

    res.json(result.rows[0]);

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

    //const pool = await sql.connect(dbConfig);

    await pool.query(`
        INSERT INTO items (
          item_name
        )
        VALUES (
          $1
        )
      `, [item_name]);

    res.json({ message: '新增品項成功' });

  } catch (err) {
    res.status(400).json({
      error: '新增品項失敗',
      detail: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});