import assert from 'node:assert/strict'
import { resolve } from 'node:path'

const database = process.env.OMNICRAFT_TEST_DATABASE
const plaintextPassword = process.env.OMNICRAFT_TEST_PASSWORD
const connectionString = process.env.DATABASE_URL

assert(
  database && plaintextPassword && connectionString,
  'The auth verification environment is incomplete.',
)

let storedPassword

if (database === 'postgres') {
  const { Client } = await import('pg')
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const result = await client.query('SELECT password FROM account LIMIT 1')
    storedPassword = result.rows[0]?.password
  } finally {
    await client.end()
  }
} else if (database === 'mysql') {
  const { createConnection } = await import('mysql2/promise')
  const connection = await createConnection(connectionString)
  try {
    const [rows] = await connection.query('SELECT password FROM account LIMIT 1')
    storedPassword = rows[0]?.password
  } finally {
    await connection.end()
  }
} else if (database === 'sqlite') {
  const { default: Database } = await import('better-sqlite3')
  const filename = resolve(connectionString.replace(/^file:/, ''))
  const connection = new Database(filename)
  try {
    storedPassword = connection.prepare('SELECT password FROM account LIMIT 1').get()?.password
  } finally {
    connection.close()
  }
} else {
  throw new Error('Unsupported database for the auth password check.')
}

assert.equal(typeof storedPassword, 'string', 'The email/password credential should be stored.')
assert.notEqual(
  storedPassword,
  plaintextPassword,
  'The account table must not contain a plaintext password.',
)
assert(storedPassword.length >= 32, 'The stored password value should be a password hash.')
console.log('Stored auth credential is not plaintext.')
