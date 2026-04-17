import sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'sneakychat-db',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'password',
  options: {
    encrypt: true,
    trustServerCertificate: process.env.NODE_ENV !== 'production',
  },
};

let pool: sql.ConnectionPool | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔧 Connecting to:', config.server);
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ Database connected');

    // Create blocked_users table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'blocked_users')
      BEGIN
        CREATE TABLE blocked_users (
          user_id NVARCHAR(255) PRIMARY KEY,
          reason NVARCHAR(500),
          suspended_until BIGINT NOT NULL,
          created_at BIGINT NOT NULL,
          created_by NVARCHAR(255),
          is_permanent BIT NOT NULL DEFAULT 0,
          ip_address NVARCHAR(45)
        )
      END
    `);
    console.log('📦 blocked_users table ready');

    // Create admins table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admins')
      BEGIN
        CREATE TABLE admins (
          user_id NVARCHAR(255) PRIMARY KEY,
          role NVARCHAR(50) NOT NULL DEFAULT 'moderator',
          created_at BIGINT NOT NULL,
          created_by NVARCHAR(255),
          is_active BIT NOT NULL DEFAULT 1
        )
      END
    `);
    console.log('📦 admins table ready');

    // Create admin_credentials table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_credentials')
      BEGIN
        CREATE TABLE admin_credentials (
          id INT PRIMARY KEY IDENTITY(1,1),
          admin_user_id NVARCHAR(255) NOT NULL UNIQUE,
          username NVARCHAR(255) NOT NULL UNIQUE,
          password_hash NVARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL,
          last_login BIGINT,
          is_active BIT NOT NULL DEFAULT 1,
          FOREIGN KEY (admin_user_id) REFERENCES admins(user_id)
        )
      END
    `);
    console.log('📦 admin_credentials table ready');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    throw err;
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.close();
    console.log('🔌 Database disconnected');
  }
}
