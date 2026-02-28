const { pool } = require('./database');

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'admin'
      );
    `);
    
    await pool.query(`
      INSERT INTO users (email, password, role) 
      VALUES ('admin@gmail.com', 'admin', 'admin') 
      ON CONFLICT (email) DO NOTHING;
    `);
    
    console.log('Users table and admin created');
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

setup();
