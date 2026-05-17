const { Pool } = require('pg');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

const pool = new Pool({ connectionString: 'postgresql://paperclip:paperclip123@127.0.0.1:5432/paperclip' });

async function hashPw(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(pw, salt, 64);
  return salt + ':' + hash.toString('hex');
}

async function run() {
  const h1 = await hashPw('Lennox2024!');
  await pool.query(
    'INSERT INTO dashboard_users (dashboard, username, password_hash, must_change_pw) VALUES ($1,$2,$3,$4) ON CONFLICT (dashboard,username) DO NOTHING',
    ['lennox', 'carlos', h1, true]
  );
  console.log('lennox/carlos done');

  const h2 = await hashPw('Keto2024!');
  await pool.query(
    'INSERT INTO dashboard_users (dashboard, username, password_hash, must_change_pw) VALUES ($1,$2,$3,$4) ON CONFLICT (dashboard,username) DO NOTHING',
    ['ketolabs', 'kevin', h2, true]
  );
  console.log('ketolabs/kevin done');

  const check = await pool.query('SELECT dashboard, username, must_change_pw FROM dashboard_users');
  console.log('Users:', JSON.stringify(check.rows));
  await pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
